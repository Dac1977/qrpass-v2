import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';
import { sendPushNotification } from '../lib/push';

const avisos = new Hono();

avisos.use('*', authMiddleware);

const crearAvisoSchema = z.object({
  spaceId: z.string().uuid(),
  titulo: z.string().min(1),
  contenido: z.string().min(1),
});

// GET /avisos/space/:id — listar avisos activos del space
avisos.get('/space/:id', async (c) => {
  const avisosList = await prisma.aviso.findMany({
    where: { spaceId: c.req.param('id'), activo: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return c.json({ avisos: avisosList });
});

// POST /avisos — crear aviso (admin)
avisos.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', crearAvisoSchema),
  async (c) => {
    const { userId } = c.get('user');
    const data = c.req.valid('json');

    const aviso = await prisma.aviso.create({
      data: { ...data, autorId: userId },
    });

    // Notificar a todos los vecinos del space
    const miembros = await prisma.membership.findMany({
      where: { spaceId: data.spaceId, activo: true, rol: 'vecino' },
    });

    const userIds = miembros.map((m) => m.userId);
    if (userIds.length > 0) {
      const usuarios = await prisma.user.findMany({
        where: { id: { in: userIds }, expoPushToken: { not: null } },
        select: { expoPushToken: true },
      });
      const tokens = usuarios.map((u) => u.expoPushToken!);
      if (tokens.length > 0) {
        await sendPushNotification(tokens, {
          title: `📢 ${data.titulo}`,
          body: data.contenido.substring(0, 100),
          data: { avisoId: aviso.id, spaceId: data.spaceId },
        });
      }
    }

    return c.json({ aviso }, 201);
  }
);

// PATCH /avisos/:id — editar aviso
avisos.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', crearAvisoSchema.partial().omit({ spaceId: true })),
  async (c) => {
    const aviso = await prisma.aviso.update({
      where: { id: c.req.param('id') },
      data: c.req.valid('json'),
    });
    return c.json({ aviso });
  }
);

// DELETE /avisos/:id — desactivar aviso
avisos.delete('/:id', requireRol('admin', 'super_admin'), async (c) => {
  await prisma.aviso.update({
    where: { id: c.req.param('id') },
    data: { activo: false },
  });
  return c.json({ ok: true });
});

export default avisos;
