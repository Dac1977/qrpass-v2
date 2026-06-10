import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const reservas = new Hono();
reservas.use('*', authMiddleware);

const timeRegex = /^\d{2}:\d{2}$/;

const createReservaSchema = z.object({
  amenityId: z.string().uuid(),
  fecha: z.string().min(10),
  horaInicio: z.string().regex(timeRegex, 'Formato HH:MM'),
  horaFin: z.string().regex(timeRegex, 'Formato HH:MM'),
  monto: z.number().min(0).optional().default(0),
  metodoPago: z.enum(['mercadopago', 'transferencia', 'sin_costo']).optional().default('sin_costo'),
  comprobante: z.string().url().optional(),
  notas: z.string().max(500).nullable().optional(),
});

const updateReservaSchema = z.object({
  estado: z.enum(['pendiente', 'confirmada', 'rechazada', 'cancelada']).optional(),
  estadoPago: z.enum(['sin_costo', 'pendiente_mp', 'pendiente_transferencia', 'pagado', 'rechazado']).optional(),
  comprobante: z.string().url().optional(),
});

const normalizeFecha = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Fecha inválida');
  return date;
};

reservas.get('/mis', async (c) => {
  const { userId } = c.get('user');
  const lista = await prisma.reserva.findMany({
    where: { vecinoId: userId },
    orderBy: { createdAt: 'desc' },
    include: { amenity: true },
  });
  return c.json({ reservas: lista });
});

reservas.get('/space/:id', requireRol('admin', 'super_admin'), async (c) => {
  const lista = await prisma.reserva.findMany({
    where: { spaceId: c.req.param('id') },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { amenity: true, vecino: true },
  });
  return c.json({ reservas: lista });
});

reservas.post('/', zValidator('json', createReservaSchema), async (c) => {
  const { userId } = c.get('user');
  const payload = c.req.valid('json');

  const amenity = await prisma.amenity.findUnique({ where: { id: payload.amenityId } });
  if (!amenity || !amenity.activo) return c.json({ error: 'Amenity no disponible' }, 404);

  const membership = await prisma.membership.findFirst({
    where: { userId, spaceId: amenity.spaceId, estadoAprobacion: 'aprobado', activo: true },
  });
  if (!membership) return c.json({ error: 'No sos miembro del espacio' }, 403);

  const estadoInicial = amenity.requiereAprobacion ? 'pendiente' : 'confirmada';
  const estadoPago = payload.monto && payload.monto > 0
    ? payload.metodoPago === 'transferencia'
      ? 'pendiente_transferencia'
      : payload.metodoPago === 'mercadopago'
        ? 'pendiente_mp'
        : 'sin_costo'
    : 'sin_costo';

  const reserva = await prisma.reserva.create({
    data: {
      spaceId: amenity.spaceId,
      amenityId: amenity.id,
      vecinoId: userId,
      fecha: normalizeFecha(payload.fecha),
      horaInicio: payload.horaInicio,
      horaFin: payload.horaFin,
      estado: estadoInicial,
      monto: payload.monto ?? 0,
      estadoPago,
      metodoPago: payload.metodoPago,
      comprobante: payload.comprobante,
      notas: payload.notas ?? undefined,
    },
    include: { amenity: true },
  });

  return c.json({ reserva }, 201);
});

reservas.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', updateReservaSchema),
  async (c) => {
    const reserva = await prisma.reserva.findUnique({ where: { id: c.req.param('id') } });
    if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);

    const data = c.req.valid('json');
    const updated = await prisma.reserva.update({ where: { id: reserva.id }, data });
    return c.json({ reserva: updated });
  }
);

export default reservas;
