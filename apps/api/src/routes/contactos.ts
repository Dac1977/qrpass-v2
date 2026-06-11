import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const contactos = new Hono();

contactos.use('*', authMiddleware);

const contactoSchema = z.object({
  nombre: z.string().min(1),
  dni: z.string().optional(),
  telefono: z.string().optional(),
  patente: z.string().optional(),
  foto: z.string().optional(),
});

// GET /contactos — lista de contactos del vecino
contactos.get('/', async (c) => {
  const { userId } = c.get('user');
  const lista = await prisma.contacto.findMany({
    where: { vecinoId: userId },
    orderBy: { nombre: 'asc' },
  });
  return c.json({ contactos: lista });
});

// POST /contactos — crear contacto
contactos.post('/', zValidator('json', contactoSchema), async (c) => {
  const { userId } = c.get('user');
  const contacto = await prisma.contacto.create({
    data: { ...c.req.valid('json'), vecinoId: userId },
  });
  return c.json({ contacto }, 201);
});

// PATCH /contactos/:id — editar contacto
contactos.patch('/:id', zValidator('json', contactoSchema.partial()), async (c) => {
  const { userId } = c.get('user');
  const existente = await prisma.contacto.findUnique({ where: { id: c.req.param('id') } });

  if (!existente || existente.vecinoId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const contacto = await prisma.contacto.update({
    where: { id: c.req.param('id') },
    data: c.req.valid('json'),
  });
  return c.json({ contacto });
});

// DELETE /contactos/:id — eliminar contacto
contactos.delete('/:id', async (c) => {
  const { userId } = c.get('user');
  const existente = await prisma.contacto.findUnique({ where: { id: c.req.param('id') } });

  if (!existente || existente.vecinoId !== userId) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  await prisma.contacto.delete({ where: { id: c.req.param('id') } });
  return c.json({ ok: true });
});

export default contactos;
