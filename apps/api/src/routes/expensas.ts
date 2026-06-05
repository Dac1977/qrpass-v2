import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const expensas = new Hono();

expensas.use('*', authMiddleware);

const crearExpensaSchema = z.object({
  spaceId: z.string().uuid(),
  userId: z.string().uuid(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2024),
  monto: z.number().positive(),
  fechaVenc: z.string().datetime().optional(),
});

const generarMasivoSchema = z.object({
  spaceId: z.string().uuid(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2024),
  monto: z.number().positive(),
  fechaVenc: z.string().datetime().optional(),
});

// GET /expensas/mis-expensas — expensas del usuario autenticado
expensas.get('/mis-expensas', async (c) => {
  const { userId } = c.get('user');

  const lista = await prisma.expensa.findMany({
    where: { userId },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  });

  return c.json({ expensas: lista });
});

// GET /expensas/space/:id — todas las expensas del space (admin)
expensas.get('/space/:id', requireRol('admin', 'super_admin'), async (c) => {
  const { mes, anio, estado } = c.req.query();

  const lista = await prisma.expensa.findMany({
    where: {
      spaceId: c.req.param('id'),
      ...(mes ? { mes: Number(mes) } : {}),
      ...(anio ? { anio: Number(anio) } : {}),
      ...(estado ? { estado: estado as any } : {}),
    },
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
  });

  return c.json({ expensas: lista });
});

// POST /expensas — crear una expensa individual
expensas.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', crearExpensaSchema),
  async (c) => {
    const data = c.req.valid('json');
    const expensa = await prisma.expensa.create({
      data: {
        ...data,
        fechaVenc: data.fechaVenc ? new Date(data.fechaVenc) : undefined,
      },
    });
    return c.json({ expensa }, 201);
  }
);

// POST /expensas/generar — generar expensas para todos los vecinos del space
expensas.post(
  '/generar',
  requireRol('admin', 'super_admin'),
  zValidator('json', generarMasivoSchema),
  async (c) => {
    const { spaceId, mes, anio, monto, fechaVenc } = c.req.valid('json');

    const miembros = await prisma.membership.findMany({
      where: { spaceId, activo: true, estadoAprobacion: 'aprobado', rol: 'vecino' },
    });

    const creadas = await prisma.$transaction(
      miembros.map((m) =>
        prisma.expensa.upsert({
          where: { userId_spaceId_mes_anio: { userId: m.userId, spaceId, mes, anio } },
          create: {
            userId: m.userId,
            spaceId,
            mes,
            anio,
            monto,
            fechaVenc: fechaVenc ? new Date(fechaVenc) : undefined,
          },
          update: {},
        })
      )
    );

    return c.json({ creadas: creadas.length }, 201);
  }
);

// PATCH /expensas/:id/pagar — marcar como pagada
expensas.patch('/:id/pagar', async (c) => {
  const { userId, rol } = c.get('user');

  const expensa = await prisma.expensa.findUnique({ where: { id: c.req.param('id') } });
  if (!expensa) return c.json({ error: 'No encontrada' }, 404);

  if (rol !== 'admin' && rol !== 'super_admin' && expensa.userId !== userId) {
    return c.json({ error: 'Sin permisos' }, 403);
  }

  const actualizada = await prisma.expensa.update({
    where: { id: expensa.id },
    data: { estado: 'pagada', fechaPago: new Date() },
  });

  return c.json({ expensa: actualizada });
});

export default expensas;
