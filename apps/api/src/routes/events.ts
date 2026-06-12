import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const events = new Hono();
events.use('*', authMiddleware);

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

// PATCH /events/:id — actualizar evento (cancelar)
events.patch(
  '/:id',
  zValidator('json', z.object({ activo: z.boolean().optional() })),
  async (c) => {
    const { userId } = c.get('user');
    const evento = await prisma.event.findUnique({ where: { id: c.req.param('id') } });
    if (!evento) return c.json({ error: 'Evento no encontrado' }, 404);

    // Solo el organizador puede cancelar
    // Nota: Necesitamos agregar organizadorId al modelo Event
    const data = c.req.valid('json');
    const actualizado = await prisma.event.update({
      where: { id: evento.id },
      data: { activo: data.activo ?? !evento.activo },
    });
    return c.json({ event: actualizado });
  }
);

// GET /events/:id/links — listar links de un evento
events.get('/:id/links', async (c) => {
  const eventoId = c.req.param('id');
  const links = await prisma.eventLink.findMany({
    where: { eventId: eventoId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ links });
});

// POST /events/:id/links — crear link para evento
events.post(
  '/:id/links',
  zValidator('json', z.object({
    permiteAcompanantes: z.boolean().default(false),
    maxAcompanantes: z.number().int().default(0),
    requiereDni: z.boolean().default(false),
    usosPorPersona: z.number().int().default(1),
  })),
  async (c) => {
    const eventoId = c.req.param('id');
    const data = c.req.valid('json');
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();

    const link = await prisma.eventLink.create({
      data: {
        eventId: eventoId,
        token,
        ...data,
      },
    });
    return c.json({ link }, 201);
  }
);

// PATCH /events/links/:id — actualizar link (habilitar/deshabilitar)
events.patch(
  '/links/:id',
  zValidator('json', z.object({ habilitado: z.boolean().optional() })),
  async (c) => {
    const link = await prisma.eventLink.findUnique({ where: { id: c.req.param('id') } });
    if (!link) return c.json({ error: 'Link no encontrado' }, 404);

    const data = c.req.valid('json');
    const actualizado = await prisma.eventLink.update({
      where: { id: link.id },
      data: { habilitado: data.habilitado ?? !link.habilitado },
    });
    return c.json({ link: actualizado });
  }
);

// GET /events/links/:id/solicitudes — listar solicitudes de un link
events.get('/links/:id/solicitudes', async (c) => {
  const linkId = c.req.param('id');
  const solicitudes = await prisma.eventSolicitud.findMany({
    where: { eventLinkId: linkId },
    orderBy: { createdAt: 'desc' },
  });
  return c.json({ solicitudes });
});

// PATCH /events/solicitudes/:id — actualizar solicitud (aceptar/rechazar)
events.patch(
  '/solicitudes/:id',
  zValidator('json', z.object({ estado: z.enum(['aceptada', 'rechazada']) })),
  async (c) => {
    const solicitud = await prisma.eventSolicitud.findUnique({ where: { id: c.req.param('id') } });
    if (!solicitud) return c.json({ error: 'Solicitud no encontrada' }, 404);

    const data = c.req.valid('json');
    const actualizada = await prisma.eventSolicitud.update({
      where: { id: solicitud.id },
      data: {
        estado: data.estado,
        acceptedAt: data.estado === 'aceptada' ? new Date() : null,
        rejectedAt: data.estado === 'rechazada' ? new Date() : null,
      },
    });
    return c.json({ solicitud: actualizada });
  }
);

export default events;
