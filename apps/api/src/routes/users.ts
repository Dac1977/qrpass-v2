import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const users = new Hono();

users.use('*', authMiddleware);

// GET /users — lista todos los usuarios (super_admin)
users.get('/', requireRol('super_admin'), async (c) => {
  const { search, rol, spaceId } = c.req.query();

  const lista = await prisma.user.findMany({
    where: {
      ...(rol ? { rol: rol as any } : {}),
      ...(search ? {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      barrioId: true,
      numeroCasa: true,
      telefono: true,
      activo: true,
      estadoAprobacion: true,
      expoPushToken: true,
      qrCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({ users: lista });
});

// GET /users/:id
users.get('/:id', requireRol('admin', 'super_admin'), async (c) => {
  const user = await prisma.user.findUnique({
    where: { id: c.req.param('id') },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      barrioId: true,
      numeroCasa: true,
      telefono: true,
      activo: true,
      estadoAprobacion: true,
      qrCode: true,
      createdAt: true,
    },
  });
  if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
  return c.json({ user });
});

// PATCH /users/:id — actualizar rol, activo, etc (super_admin o admin)
users.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', z.object({
    rol: z.enum(['vecino', 'guardia', 'admin', 'super_admin']).optional(),
    activo: z.boolean().optional(),
    estadoAprobacion: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
    nombre: z.string().optional(),
    telefono: z.string().optional(),
    numeroCasa: z.string().optional(),
    barrioId: z.string().optional(),
    expoPushToken: z.string().optional(),
  })),
  async (c) => {
    const user = await prisma.user.update({
      where: { id: c.req.param('id') },
      data: c.req.valid('json'),
      select: {
        id: true, email: true, nombre: true, rol: true,
        activo: true, estadoAprobacion: true,
      },
    });
    return c.json({ user });
  }
);

// DELETE /users/:id (super_admin)
users.delete('/:id', requireRol('super_admin'), async (c) => {
  await prisma.user.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});

export default users;
