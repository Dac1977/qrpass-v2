import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const invitaciones = new Hono();

invitaciones.use('*', authMiddleware);

const crearInvitacionSchema = z.object({
  spaceId: z.string().uuid(),
  nombre: z.string().min(1),
  dni: z.string().optional(),
  telefono: z.string().optional(),
  patente: z.string().optional(),
  tipo: z.enum(['visita', 'delivery']).default('visita'),
  usosMaximos: z.number().int().min(1).default(1),
  horasVigencia: z.number().int().min(1).optional(),
});

// GET /invitaciones/mis — invitaciones del vecino autenticado
invitaciones.get('/mis', async (c) => {
  const { userId } = c.get('user');
  const { spaceId } = c.req.query();

  const lista = await prisma.invitacion.findMany({
    where: {
      vecinoId: userId,
      ...(spaceId && { spaceId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return c.json({ invitaciones: lista });
});

// GET /invitaciones/:id — detalle
invitaciones.get('/:id', async (c) => {
  const { userId } = c.get('user');
  const inv = await prisma.invitacion.findUnique({ where: { id: c.req.param('id') } });

  if (!inv || inv.vecinoId !== userId) {
    return c.json({ error: 'No encontrado' }, 404);
  }
  return c.json({ invitacion: inv });
});

// GET /invitaciones/space/:spaceId/buscar — búsqueda manual para guardia
invitaciones.get(
  '/space/:spaceId/buscar',
  requireRol('guardia', 'admin', 'super_admin'),
  async (c) => {
    const spaceId = c.req.param('spaceId');
    const query = c.req.query('q')?.toLowerCase();

    if (!query) {
      return c.json({ resultados: [] });
    }

    // Buscar en invitaciones
    const invitaciones = await prisma.invitacion.findMany({
      where: {
        spaceId,
        activo: true,
        OR: [
          { nombre: { contains: query, mode: 'insensitive' } },
          { dni: { contains: query, mode: 'insensitive' } },
          { patente: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });

    // Buscar en usuarios registrados
    const usuarios = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            spaceId,
            activo: true,
            estadoAprobacion: 'aprobado',
          },
        },
        OR: [
          { nombre: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        numeroCasa: true,
      },
      take: 20,
    });

    return c.json({
      resultados: [
        ...invitaciones.map((inv) => ({
          id: inv.id,
          tipo: 'invitacion',
          nombre: inv.nombre,
          dni: inv.dni,
          patente: inv.patente,
          qrCode: inv.qrCode,
        })),
        ...usuarios.map((u) => ({
          id: u.id,
          tipo: 'usuario',
          nombre: u.nombre,
          email: u.email,
          numeroCasa: u.numeroCasa,
          qrCode: u.qrCode,
        })),
      ],
    });
  }
);

// POST /invitaciones — crear invitación
invitaciones.post('/', zValidator('json', crearInvitacionSchema), async (c) => {
  const { userId } = c.get('user');
  const { horasVigencia, ...data } = c.req.valid('json');

  const fechaVence = horasVigencia
    ? new Date(Date.now() + horasVigencia * 60 * 60 * 1000)
    : undefined;

  const inv = await prisma.invitacion.create({
    data: {
      ...data,
      vecinoId: userId,
      qrCode: randomUUID(),
      fechaVence,
    },
  });

  return c.json({ invitacion: inv }, 201);
});

// DELETE /invitaciones/:id — revocar invitación
invitaciones.delete('/:id', async (c) => {
  const { userId } = c.get('user');
  const inv = await prisma.invitacion.findUnique({ where: { id: c.req.param('id') } });

  if (!inv || inv.vecinoId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  await prisma.invitacion.update({
    where: { id: c.req.param('id') },
    data: { activo: false },
  });
  return c.json({ ok: true });
});

export default invitaciones;
