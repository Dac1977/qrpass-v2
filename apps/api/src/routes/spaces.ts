import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const spaces = new Hono();

// GET /spaces/by-code/:codigo — endpoint público (sin auth)
spaces.get('/by-code/:codigo', async (c) => {
  const space = await prisma.space.findUnique({
    where: { codigoInvitacion: c.req.param('codigo').toUpperCase() },
    select: { id: true, nombre: true, spaceType: true, activo: true },
  });
  if (!space || !space.activo) return c.json({ error: 'Código inválido' }, 404);
  return c.json({ space });
});

spaces.use('*', authMiddleware);

const createSpaceSchema = z.object({
  nombre: z.string().min(1),
  organizationId: z.string().uuid(),
  direccion: z.string().optional(),
  spaceType: z.enum(['residential', 'gym', 'club', 'coworking', 'event', 'other']).optional(),
  precioPorCasa: z.number().optional(),
});

const updateSpaceSchema = createSpaceSchema.partial().omit({ organizationId: true });

// GET /spaces — lista spaces del usuario o todos si super_admin
spaces.get('/', async (c) => {
  const { userId, rol } = c.get('user');

  if (rol === 'super_admin') {
    const all = await prisma.space.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { nombre: true, slug: true } },
        _count: { select: { memberships: true } },
      },
    });
    return c.json({ spaces: all });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId, activo: true },
    include: {
      space: {
        include: { organization: { select: { nombre: true, slug: true } } },
      },
    },
  });
  return c.json({ spaces: memberships.map((m) => ({ ...m.space, rol: m.rol })) });
});

// POST /spaces — crear space (admin o super_admin)
spaces.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', createSpaceSchema),
  async (c) => {
    const data = c.req.valid('json');

    const codigoInvitacion = Math.random().toString(36).substring(2, 8).toUpperCase();

    const space = await prisma.space.create({
      data: { ...data, codigoInvitacion },
      include: { organization: { select: { nombre: true } } },
    });
    return c.json({ space }, 201);
  }
);

// GET /spaces/:id
spaces.get('/:id', async (c) => {
  const space = await prisma.space.findUnique({
    where: { id: c.req.param('id') },
    include: {
      organization: true,
      _count: { select: { memberships: true } },
    },
  });
  if (!space) return c.json({ error: 'Space no encontrado' }, 404);
  return c.json({ space });
});

// PATCH /spaces/:id
spaces.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', updateSpaceSchema),
  async (c) => {
    const space = await prisma.space.findUnique({ where: { id: c.req.param('id') } });
    if (!space) return c.json({ error: 'No encontrado' }, 404);

    const updated = await prisma.space.update({
      where: { id: space.id },
      data: c.req.valid('json'),
    });
    return c.json({ space: updated });
  }
);

// GET /spaces/:id/members — lista miembros
spaces.get('/:id/members', async (c) => {
  const members = await prisma.membership.findMany({
    where: { spaceId: c.req.param('id') },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ members });
});

// GET /spaces/mis-memberships — memberships del usuario autenticado
spaces.get('/mis-memberships', async (c) => {
  const { userId } = c.get('user');
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { space: { select: { nombre: true, spaceType: true, codigoInvitacion: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({
    memberships: memberships.map((m) => ({
      spaceId: m.spaceId,
      spaceName: m.space.nombre,
      spaceType: m.space.spaceType,
      rol: m.rol,
      numeroUnidad: m.numeroUnidad,
      activo: m.activo,
      estadoAprobacion: m.estadoAprobacion,
      codigoInvitacion: m.space.codigoInvitacion,
    })),
  });
});

// POST /spaces/join — unirse con código de invitación
spaces.post(
  '/join',
  zValidator('json', z.object({
    codigoInvitacion: z.string().min(1),
    numeroUnidad: z.string().optional(),
  })),
  async (c) => {
    const { userId } = c.get('user');
    const { codigoInvitacion, numeroUnidad } = c.req.valid('json');

    const space = await prisma.space.findUnique({ where: { codigoInvitacion } });
    if (!space) return c.json({ error: 'Código inválido' }, 404);
    if (!space.activo) return c.json({ error: 'Este space no está activo' }, 403);

    const existing = await prisma.membership.findUnique({
      where: { userId_spaceId: { userId, spaceId: space.id } },
    });
    if (existing) return c.json({ error: 'Ya sos miembro de este space' }, 409);

    const membership = await prisma.membership.create({
      data: {
        userId,
        spaceId: space.id,
        numeroUnidad,
        estadoAprobacion: 'pendiente',
        activo: false,
      },
    });
    return c.json({ membership, space: { id: space.id, nombre: space.nombre } }, 201);
  }
);

// PATCH /spaces/:id/members/:userId/approve
spaces.patch(
  '/:id/members/:userId/approve',
  requireRol('admin', 'super_admin'),
  async (c) => {
    const { userId: adminId } = c.get('user');
    const { id: spaceId, userId: targetUserId } = c.req.param();

    const membership = await prisma.membership.update({
      where: { userId_spaceId: { userId: targetUserId, spaceId } },
      data: {
        estadoAprobacion: 'aprobado',
        activo: true,
        fechaAprobacion: new Date(),
        aprobadoPor: adminId,
      },
    });
    return c.json({ membership });
  }
);

// PATCH /spaces/:id/members/:userId/reject
spaces.patch(
  '/:id/members/:userId/reject',
  requireRol('admin', 'super_admin'),
  async (c) => {
    const { id: spaceId, userId: targetUserId } = c.req.param();

    const membership = await prisma.membership.update({
      where: { userId_spaceId: { userId: targetUserId, spaceId } },
      data: { estadoAprobacion: 'rechazado', activo: false },
    });
    return c.json({ membership });
  }
);

export default spaces;
