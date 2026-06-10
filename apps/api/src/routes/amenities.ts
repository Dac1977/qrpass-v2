import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const amenities = new Hono();
amenities.use('*', authMiddleware);

const timeRegex = /^\d{2}:\d{2}$/;

const turnoSchema = z.object({
  id: z.string().min(1),
  etiqueta: z.string().nullable().optional(),
  hora_inicio: z.string().regex(timeRegex, 'Formato HH:MM'),
  hora_fin: z.string().regex(timeRegex, 'Formato HH:MM'),
});

const createAmenitySchema = z.object({
  spaceId: z.string().uuid(),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  capacidad: z.number().int().positive().nullable().optional(),
  horaApertura: z.string().regex(timeRegex, 'Formato HH:MM'),
  horaCierre: z.string().regex(timeRegex, 'Formato HH:MM'),
  requiereAprobacion: z.boolean().optional().default(false),
  precioReserva: z.number().min(0).optional().default(0),
  turnosConfig: z.array(turnoSchema).optional(),
  activo: z.boolean().optional(),
});

const updateAmenitySchema = createAmenitySchema.omit({ spaceId: true }).partial();

const mapPayloadToData = (payload: z.infer<typeof createAmenitySchema> | z.infer<typeof updateAmenitySchema>) => ({
  ...(payload.spaceId ? { spaceId: payload.spaceId } : {}),
  ...(payload.nombre ? { nombre: payload.nombre } : {}),
  descripcion: payload.descripcion ?? (payload.descripcion === null ? null : undefined),
  capacidad: payload.capacidad ?? (payload.capacidad === null ? null : undefined),
  ...(payload.horaApertura ? { horaApertura: payload.horaApertura } : {}),
  ...(payload.horaCierre ? { horaCierre: payload.horaCierre } : {}),
  ...(payload.requiereAprobacion !== undefined ? { requiereAprobacion: payload.requiereAprobacion } : {}),
  ...(payload.precioReserva !== undefined ? { precioReserva: payload.precioReserva } : {}),
  ...(payload.turnosConfig ? { turnosConfig: payload.turnosConfig } : payload.turnosConfig === null ? { turnosConfig: null } : {}),
  ...(payload.activo !== undefined ? { activo: payload.activo } : {}),
});

amenities.get('/space/:id', async (c) => {
  const includeInactive = c.req.query('includeInactive') === 'true';
  const lista = await prisma.amenity.findMany({
    where: { spaceId: c.req.param('id'), ...(includeInactive ? {} : { activo: true }) },
    orderBy: { nombre: 'asc' },
  });
  return c.json({ amenities: lista });
});

amenities.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', createAmenitySchema),
  async (c) => {
    const data = mapPayloadToData(c.req.valid('json'));
    const amenity = await prisma.amenity.create({ data });
    return c.json({ amenity }, 201);
  }
);

amenities.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', updateAmenitySchema),
  async (c) => {
    const amenity = await prisma.amenity.findUnique({ where: { id: c.req.param('id') } });
    if (!amenity) return c.json({ error: 'Amenity no encontrado' }, 404);

    const data = mapPayloadToData(c.req.valid('json'));
    const updated = await prisma.amenity.update({ where: { id: amenity.id }, data });
    return c.json({ amenity: updated });
  }
);

amenities.patch(
  '/:id/toggle',
  requireRol('admin', 'super_admin'),
  zValidator('json', z.object({ activo: z.boolean().optional() }).optional()),
  async (c) => {
    const amenity = await prisma.amenity.findUnique({ where: { id: c.req.param('id') } });
    if (!amenity) return c.json({ error: 'Amenity no encontrado' }, 404);

    const body = c.req.valid('json') ?? {};
    const nextEstado = body.activo ?? !amenity.activo;
    const updated = await prisma.amenity.update({ where: { id: amenity.id }, data: { activo: nextEstado } });
    return c.json({ amenity: updated });
  }
);

export default amenities;
