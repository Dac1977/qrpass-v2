import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const terminales = new Hono();

terminales.use('*', authMiddleware);

const createTerminalSchema = z.object({
  spaceId: z.string().uuid(),
  nombre: z.string().min(1),
});

const updateTerminalSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

const createGateSchema = z.object({
  terminalId: z.string().uuid(),
  nombre: z.string().min(1),
  tipo: z.enum(['IN', 'OUT', 'BOTH']).default('BOTH'),
});

const updateGateSchema = z.object({
  nombre: z.string().min(1).optional(),
  tipo: z.enum(['IN', 'OUT', 'BOTH']).optional(),
  activo: z.boolean().optional(),
  orden: z.number().optional(),
});

// GET /terminales/space/:spaceId — listar terminales de un space
terminales.get(
  '/space/:spaceId',
  requireRol('admin', 'super_admin'),
  async (c) => {
    const spaceId = c.req.param('spaceId');
    const terminales = await prisma.terminal.findMany({
      where: { spaceId },
      include: { gates: true },
      orderBy: { createdAt: 'desc' },
    });
    return c.json({ terminales });
  }
);

// POST /terminales — crear terminal
terminales.post(
  '/',
  requireRol('admin', 'super_admin'),
  zValidator('json', createTerminalSchema),
  async (c) => {
    const data = c.req.valid('json');
    const terminal = await prisma.terminal.create({
      data,
      include: { gates: true },
    });
    return c.json({ terminal });
  }
);

// PATCH /terminales/:id — actualizar terminal
terminales.patch(
  '/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', updateTerminalSchema),
  async (c) => {
    const id = c.req.param('id');
    const terminal = await prisma.terminal.update({
      where: { id },
      data: c.req.valid('json'),
      include: { gates: true },
    });
    return c.json({ terminal });
  }
);

// DELETE /terminales/:id — eliminar terminal
terminales.delete(
  '/:id',
  requireRol('admin', 'super_admin'),
  async (c) => {
    const id = c.req.param('id');
    await prisma.terminal.delete({ where: { id } });
    return c.json({ success: true });
  }
);

// POST /gates — crear gate
terminales.post(
  '/gates',
  requireRol('admin', 'super_admin'),
  zValidator('json', createGateSchema),
  async (c) => {
    const data = c.req.valid('json');
    const gate = await prisma.gate.create({
      data,
    });
    return c.json({ gate });
  }
);

// PATCH /gates/:id — actualizar gate
terminales.patch(
  '/gates/:id',
  requireRol('admin', 'super_admin'),
  zValidator('json', updateGateSchema),
  async (c) => {
    const id = c.req.param('id');
    const gate = await prisma.gate.update({
      where: { id },
      data: c.req.valid('json'),
    });
    return c.json({ gate });
  }
);

// DELETE /gates/:id — eliminar gate
terminales.delete(
  '/gates/:id',
  requireRol('admin', 'super_admin'),
  async (c) => {
    const id = c.req.param('id');
    await prisma.gate.delete({ where: { id } });
    return c.json({ success: true });
  }
);

export default terminales;
