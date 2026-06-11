import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';
import { sendPushNotification } from '../lib/push';

const encuestas = new Hono();

encuestas.use('*', authMiddleware);

const crearEncuestaSchema = z.object({
  spaceId: z.string().uuid(),
  titulo: z.string().min(1),
  descripcion: z.string().optional(),
  opciones: z.array(z.string().min(1)).min(2),
  multiple: z.boolean().default(false),
  fechaCierre: z.string().datetime().optional(),
});

const votarSchema = z.object({
  opciones: z.array(z.number().int().min(0)),
});

// GET /encuestas/space/:id — listar encuestas activas del space
encuestas.get('/space/:id', async (c) => {
  const { userId } = c.get('user');

  const lista = await prisma.encuesta.findMany({
    where: { spaceId: c.req.param('id'), activa: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Votos del usuario autenticado
  const encuestaIds = lista.map((e) => e.id);
  const misVotos = await prisma.voto.findMany({
    where: { encuestaId: { in: encuestaIds }, vecinoId: userId },
  });

  // Resultados (conteo de votos por opción)
  const todosVotos = await prisma.voto.findMany({
    where: { encuestaId: { in: encuestaIds } },
    select: { encuestaId: true, opciones: true },
  });

  const resultadosMap: Record<string, number[]> = {};
  for (const v of todosVotos) {
    const opciones = v.opciones as number[];
    if (!resultadosMap[v.encuestaId]) {
      const enc = lista.find((e) => e.id === v.encuestaId);
      resultadosMap[v.encuestaId] = new Array((enc?.opciones as string[])?.length ?? 0).fill(0);
    }
    for (const idx of opciones) {
      resultadosMap[v.encuestaId][idx] = (resultadosMap[v.encuestaId][idx] ?? 0) + 1;
    }
  }

  const misVotosMap = Object.fromEntries(misVotos.map((v) => [v.encuestaId, v.opciones]));

  return c.json({
    encuestas: lista.map((e) => ({
      ...e,
      resultados: resultadosMap[e.id] ?? [],
      miVoto: misVotosMap[e.id] ?? null,
    })),
  });
});

// POST /encuestas — crear encuesta (admin)
encuestas.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', crearEncuestaSchema),
  async (c) => {
    const { userId } = c.get('user');
    const data = c.req.valid('json');

    const encuesta = await prisma.encuesta.create({
      data: {
        ...data,
        autorId: userId,
        opciones: data.opciones,
        fechaCierre: data.fechaCierre ? new Date(data.fechaCierre) : undefined,
      },
    });

    // Notificar vecinos
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
          title: '📊 Nueva encuesta',
          body: data.titulo,
          data: { encuestaId: encuesta.id, spaceId: data.spaceId },
        });
      }
    }

    return c.json({ encuesta }, 201);
  }
);

// POST /encuestas/:id/votar — votar en encuesta
encuestas.post('/:id/votar', zValidator('json', votarSchema), async (c) => {
  const { userId } = c.get('user');
  const { opciones } = c.req.valid('json');

  const encuesta = await prisma.encuesta.findUnique({ where: { id: c.req.param('id') } });
  if (!encuesta || !encuesta.activa) {
    return c.json({ error: 'Encuesta no disponible' }, 404);
  }
  if (encuesta.fechaCierre && new Date(encuesta.fechaCierre) < new Date()) {
    return c.json({ error: 'La encuesta ya cerró' }, 400);
  }

  const yaVoto = await prisma.voto.findUnique({
    where: { encuestaId_vecinoId: { encuestaId: encuesta.id, vecinoId: userId } },
  });
  if (yaVoto) {
    return c.json({ error: 'Ya votaste en esta encuesta' }, 400);
  }

  if (!encuesta.multiple && opciones.length > 1) {
    return c.json({ error: 'Esta encuesta no permite múltiples opciones' }, 400);
  }

  const voto = await prisma.voto.create({
    data: { encuestaId: encuesta.id, vecinoId: userId, opciones },
  });

  return c.json({ voto }, 201);
});

// DELETE /encuestas/:id — desactivar encuesta (admin)
encuestas.delete('/:id', requireRol('admin', 'super_admin'), async (c) => {
  await prisma.encuesta.update({
    where: { id: c.req.param('id') },
    data: { activa: false },
  });
  return c.json({ ok: true });
});

export default encuestas;
