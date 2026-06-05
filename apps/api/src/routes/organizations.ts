import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const organizations = new Hono();

organizations.use('*', authMiddleware);

const createOrgSchema = z.object({
  nombre: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  descripcion: z.string().optional(),
  plan: z.enum(['free', 'basic', 'pro']).optional(),
});

// GET /organizations — lista todas (solo super_admin)
organizations.get('/', requireRol('super_admin'), async (c) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { spaces: true } } },
  });
  return c.json({ organizations: orgs });
});

// POST /organizations — crear org (admin o super_admin)
organizations.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', createOrgSchema),
  async (c) => {
    const { userId } = c.get('user');
    const data = c.req.valid('json');

    const exists = await prisma.organization.findUnique({ where: { slug: data.slug } });
    if (exists) return c.json({ error: 'El slug ya está en uso' }, 409);

    const org = await prisma.organization.create({
      data: { ...data, ownerId: userId },
    });
    return c.json({ organization: org }, 201);
  }
);

// GET /organizations/:id
organizations.get('/:id', async (c) => {
  const org = await prisma.organization.findUnique({
    where: { id: c.req.param('id') },
    include: { spaces: true },
  });
  if (!org) return c.json({ error: 'Organización no encontrada' }, 404);
  return c.json({ organization: org });
});

// PATCH /organizations/:id
organizations.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', createOrgSchema.partial()),
  async (c) => {
    const { userId, rol } = c.get('user');
    const org = await prisma.organization.findUnique({ where: { id: c.req.param('id') } });
    if (!org) return c.json({ error: 'No encontrada' }, 404);
    if (rol !== 'super_admin' && org.ownerId !== userId) {
      return c.json({ error: 'Sin permisos' }, 403);
    }
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: c.req.valid('json'),
    });
    return c.json({ organization: updated });
  }
);

export default organizations;
