import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const events = new Hono();

const createSolicitudSchema = z.object({
  eventLinkId: z.string().uuid(),
  nombre: z.string().min(1),
  dni: z.string().optional(),
  telefono: z.string().optional(),
  acompanantes: z.number().int().min(0).default(0),
});

// GET /events/links/:token — obtener info del link (público)
events.get('/links/:token', async (c) => {
  const token = c.req.param('token');
  const link = await prisma.eventLink.findUnique({
    where: { token },
    include: { event: true },
  });
  if (!link) return c.json({ error: 'Link no encontrado' }, 404);
  if (!link.habilitado) return c.json({ error: 'Link no habilitado' }, 403);

  return c.json({
    id: link.id,
    eventId: link.eventId,
    token: link.token,
    permiteAcompanantes: link.permiteAcompanantes,
    maxAcompanantes: link.maxAcompanantes,
    requiereDni: link.requiereDni,
    usosPorPersona: link.usosPorPersona,
    habilitado: link.habilitado,
    event: {
      nombre: link.event.nombre,
      descripcion: link.event.descripcion,
      fechaEvento: link.event.fechaEvento,
    },
  });
});

// POST /events/solicitudes — crear solicitud (público)
events.post('/solicitudes', zValidator('json', createSolicitudSchema), async (c) => {
  const { eventLinkId, nombre, dni, telefono, acompanantes } = c.req.valid('json');

  const link = await prisma.eventLink.findUnique({ where: { id: eventLinkId } });
  if (!link) return c.json({ error: 'Link no encontrado' }, 404);
  if (!link.habilitado) return c.json({ error: 'Link no habilitado' }, 403);
  if (link.requiereDni && !dni) return c.json({ error: 'DNI requerido' }, 400);
  if (acompanantes > link.maxAcompanantes) return c.json({ error: 'Máximo acompañantes excedido' }, 400);

  const token = Math.random().toString(36).substring(2, 10).toUpperCase();
  const qrCode = `EVENT-${token}`;

  const solicitud = await prisma.eventSolicitud.create({
    data: {
      eventLinkId,
      token,
      nombre,
      dni,
      telefono,
      acompanantes,
      qrCode,
      usosPermitidos: link.usosPorPersona,
    },
  });

  return c.json({ solicitud }, 201);
});

// GET /events/solicitudes/:token — obtener estado de solicitud (público)
events.get('/solicitudes/:token', async (c) => {
  const token = c.req.param('token');
  const solicitud = await prisma.eventSolicitud.findUnique({
    where: { token },
    include: { eventLink: { include: { event: true } } },
  });
  if (!solicitud) return c.json({ error: 'Solicitud no encontrada' }, 404);

  return c.json({
    id: solicitud.id,
    token: solicitud.token,
    nombre: solicitud.nombre,
    dni: solicitud.dni,
    telefono: solicitud.telefono,
    acompanantes: solicitud.acompanantes,
    estado: solicitud.estado,
    qrCode: solicitud.qrCode,
    usosPermitidos: solicitud.usosPermitidos,
    usosActuales: solicitud.usosActuales,
    acceptedAt: solicitud.acceptedAt,
    rejectedAt: solicitud.rejectedAt,
  });
});

export default events;
