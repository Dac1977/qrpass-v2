import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const personal = new Hono();

personal.use('*', authMiddleware);

const crearPersonalSchema = z.object({
  spaceId: z.string().uuid(),
  nombre: z.string().min(1),
  dni: z.string().optional(),
  foto: z.string().optional(),
  tipo: z.string().default('empleada'),
  permisos: z.array(z.object({
    diaSemana: z.number().int().min(0).max(6),
    horaEntrada: z.string().optional(),
    horaSalida: z.string().optional(),
  })).optional(),
});

const actualizarPersonalSchema = crearPersonalSchema.omit({ spaceId: true }).partial();

// GET /personal/mis — personal del vecino autenticado
personal.get('/mis', async (c) => {
  const { userId } = c.get('user');

  const permisos = await prisma.permisoHorario.findMany({
    where: { vecinoId: userId, activo: true },
    select: { personalId: true },
  });

  const personalIds = [...new Set(permisos.map((p) => p.personalId))];
  if (personalIds.length === 0) return c.json({ personal: [] });

  const lista = await prisma.personalPermanente.findMany({
    where: { id: { in: personalIds }, activo: true },
    include: { permisos: { where: { vecinoId: userId, activo: true } } },
    orderBy: { nombre: 'asc' },
  });

  return c.json({ personal: lista });
});

// GET /personal/:id — detalle de un personal
personal.get('/:id', async (c) => {
  const { userId } = c.get('user');
  const item = await prisma.personalPermanente.findUnique({
    where: { id: c.req.param('id') },
    include: { permisos: { where: { vecinoId: userId, activo: true } } },
  });

  if (!item || item.vecinoId !== userId) {
    return c.json({ error: 'No encontrado' }, 404);
  }
  return c.json({ personal: item });
});

// POST /personal — registrar personal
personal.post('/', zValidator('json', crearPersonalSchema), async (c) => {
  const { userId } = c.get('user');
  const { permisos, ...data } = c.req.valid('json');

  const item = await prisma.personalPermanente.create({
    data: {
      ...data,
      vecinoId: userId,
      qrCode: randomUUID(),
      permisos: permisos
        ? {
            create: permisos.map((p) => ({
              vecinoId: userId,
              diaSemana: p.diaSemana,
              horaEntrada: p.horaEntrada,
              horaSalida: p.horaSalida,
            })),
          }
        : undefined,
    },
    include: { permisos: true },
  });

  return c.json({ personal: item }, 201);
});

// PATCH /personal/:id — actualizar personal y/o permisos
personal.patch('/:id', zValidator('json', actualizarPersonalSchema), async (c) => {
  const { userId } = c.get('user');
  const { permisos, ...data } = c.req.valid('json');

  const existente = await prisma.personalPermanente.findUnique({ where: { id: c.req.param('id') } });
  if (!existente || existente.vecinoId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const item = await prisma.personalPermanente.update({
    where: { id: c.req.param('id') },
    data,
  });

  if (permisos !== undefined) {
    await prisma.permisoHorario.updateMany({
      where: { personalId: item.id, vecinoId: userId },
      data: { activo: false },
    });
    if (permisos.length > 0) {
      await prisma.permisoHorario.createMany({
        data: permisos.map((p) => ({
          personalId: item.id,
          vecinoId: userId,
          diaSemana: p.diaSemana,
          horaEntrada: p.horaEntrada,
          horaSalida: p.horaSalida,
        })),
      });
    }
  }

  return c.json({ personal: item });
});

// DELETE /personal/:id — desactivar personal
personal.delete('/:id', async (c) => {
  const { userId } = c.get('user');
  const existente = await prisma.personalPermanente.findUnique({ where: { id: c.req.param('id') } });
  if (!existente || existente.vecinoId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  await prisma.personalPermanente.update({
    where: { id: c.req.param('id') },
    data: { activo: false },
  });
  return c.json({ ok: true });
});

export default personal;
