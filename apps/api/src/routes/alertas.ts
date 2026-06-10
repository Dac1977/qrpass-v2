import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';
import { sendPushNotification } from '../lib/push';

const alertas = new Hono();

alertas.use('*', authMiddleware);

const crearAlertaSchema = z.object({
  spaceId: z.string().uuid(),
  tipo: z.string().min(1),
  mensaje: z.string().optional(),
  numeroCasa: z.string().optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
});

// POST /alertas — crear alerta de emergencia
alertas.post('/', zValidator('json', crearAlertaSchema), async (c) => {
  const { userId } = c.get('user');
  const data = c.req.valid('json');

  const alerta = await prisma.alertaEmergencia.create({
    data: { ...data, vecinoId: userId },
  });

  // Notificar a guardias y admins del space
  const guardias = await prisma.membership.findMany({
    where: {
      spaceId: data.spaceId,
      activo: true,
      rol: { in: ['guardia', 'admin'] },
    },
  });

  const userIds = guardias.map((g: { userId: string }) => g.userId);
  if (userIds.length > 0) {
    const usuarios = await prisma.user.findMany({
      where: { id: { in: userIds }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    });
    const tokens = usuarios.map((u: { expoPushToken: string | null }) => u.expoPushToken!);
    if (tokens.length > 0) {
      await sendPushNotification(tokens, {
        title: `🚨 Alerta: ${data.tipo}`,
        body: data.mensaje ?? 'Emergencia reportada',
        data: { alertaId: alerta.id, spaceId: data.spaceId },
      });
    }
  }

  return c.json({ alerta }, 201);
});

// GET /alertas/space/:id — listar alertas del space
alertas.get('/space/:id', requireRol('guardia', 'admin', 'super_admin'), async (c) => {
  const spaceId = c.req.param('id');
  const soloActivas = c.req.query('activas') === 'true';

  const alertasList = await prisma.alertaEmergencia.findMany({
    where: {
      spaceId,
      ...(soloActivas ? { atendida: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return c.json({ alertas: alertasList });
});

// PATCH /alertas/:id/atender — marcar como atendida
alertas.patch(
  '/:id/atender',
  requireRol('guardia', 'admin', 'super_admin'),
  async (c) => {
    const { userId } = c.get('user');

    const alerta = await prisma.alertaEmergencia.update({
      where: { id: c.req.param('id') },
      data: {
        atendida: true,
        atendidaPor: userId,
        atendidaAt: new Date(),
      },
    });

    return c.json({ alerta });
  }
);

export default alertas;
