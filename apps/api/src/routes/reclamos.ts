import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';
import { sendPushNotification } from '../lib/push';

const reclamos = new Hono();

reclamos.use('*', authMiddleware);

const crearReclamoSchema = z.object({
  spaceId: z.string().uuid(),
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  categoria: z.enum(['mantenimiento', 'seguridad', 'limpieza', 'ruidos', 'espacios_comunes', 'general', 'otro']).default('general'),
  foto: z.string().optional(),
});

const responderReclamoSchema = z.object({
  respuesta: z.string().min(1),
  estado: z.enum(['en_proceso', 'resuelto']).default('resuelto'),
});

// GET /reclamos/space/:id — listar reclamos del space
reclamos.get('/space/:id', requireRol('admin', 'super_admin', 'guardia'), async (c) => {
  const { estado, categoria } = c.req.query();

  const lista = await prisma.reclamo.findMany({
    where: {
      spaceId: c.req.param('id'),
      ...(estado && { estado: estado as any }),
      ...(categoria && { categoria: categoria as any }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const userIds = [...new Set(lista.map((r) => r.userId))];
  const usuarios = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nombre: true, numeroCasa: true },
  });
  const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));

  return c.json({ reclamos: lista.map((r) => ({ ...r, usuario: usuariosMap[r.userId] ?? null })) });
});

// GET /reclamos/mis — reclamos del usuario autenticado
reclamos.get('/mis', async (c) => {
  const { userId } = c.get('user');
  const lista = await prisma.reclamo.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ reclamos: lista });
});

// POST /reclamos — crear reclamo
reclamos.post('/', zValidator('json', crearReclamoSchema), async (c) => {
  const { userId } = c.get('user');
  const data = c.req.valid('json');

  const reclamo = await prisma.reclamo.create({
    data: { ...data, userId },
  });

  // Notificar admins del space
  const admins = await prisma.membership.findMany({
    where: { spaceId: data.spaceId, activo: true, rol: 'admin' },
  });
  const adminIds = admins.map((m) => m.userId);
  if (adminIds.length > 0) {
    const adminUsers = await prisma.user.findMany({
      where: { id: { in: adminIds }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    });
    const tokens = adminUsers.map((u) => u.expoPushToken!);
    if (tokens.length > 0) {
      await sendPushNotification(tokens, {
        title: '🔔 Nuevo reclamo',
        body: data.titulo,
        data: { reclamoId: reclamo.id, spaceId: data.spaceId },
      });
    }
  }

  return c.json({ reclamo }, 201);
});

// PATCH /reclamos/:id/responder — admin responde el reclamo
reclamos.patch(
  '/:id/responder',
  requireRol('admin', 'super_admin'),
  zValidator('json', responderReclamoSchema),
  async (c) => {
    const { userId } = c.get('user');
    const { respuesta, estado } = c.req.valid('json');

    const reclamo = await prisma.reclamo.update({
      where: { id: c.req.param('id') },
      data: { respuesta, estado, adminId: userId },
    });

    // Notificar al vecino
    const vecino = await prisma.user.findUnique({
      where: { id: reclamo.userId },
      select: { expoPushToken: true },
    });
    if (vecino?.expoPushToken) {
      await sendPushNotification([vecino.expoPushToken], {
        title: estado === 'resuelto' ? '✅ Reclamo resuelto' : '🔄 Reclamo en proceso',
        body: respuesta,
        data: { reclamoId: reclamo.id },
      });
    }

    return c.json({ reclamo });
  }
);

// DELETE /reclamos/:id — el vecino cancela su reclamo pendiente
reclamos.delete('/:id', async (c) => {
  const { userId } = c.get('user');
  const reclamo = await prisma.reclamo.findUnique({ where: { id: c.req.param('id') } });

  if (!reclamo || reclamo.userId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }
  if (reclamo.estado !== 'pendiente') {
    return c.json({ error: 'Solo se pueden eliminar reclamos pendientes' }, 400);
  }

  await prisma.reclamo.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});

export default reclamos;
