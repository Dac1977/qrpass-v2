import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, requireRol } from '../middleware/auth';

const accesos = new Hono();

accesos.use('*', authMiddleware);

const verificarSchema = z.object({
  qrCode: z.string().min(1),
  spaceId: z.string().uuid(),
  tipo: z.enum(['entrada', 'salida']).default('entrada'),
  metodo: z.enum(['qr', 'manual', 'facial']).default('qr'),
});

// POST /accesos/verificar — escanear QR y registrar ingreso
accesos.post(
  '/verificar',
  requireRol('guardia', 'admin', 'super_admin'),
  zValidator('json', verificarSchema),
  async (c) => {
    const { userId: guardiaId } = c.get('user');
    const { qrCode, spaceId, tipo, metodo } = c.req.valid('json');

    // 1. Buscar como usuario registrado
    const usuario = await prisma.user.findFirst({
      where: { qrCode },
      select: { id: true, nombre: true, activo: true, numeroCasa: true },
    });

    if (usuario) {
      if (!usuario.activo) {
        await prisma.ingreso.create({
          data: { userId: usuario.id, spaceId, tipo, metodo, autorizado: false, motivoRechazo: 'Usuario inactivo', registradoPor: guardiaId },
        });
        return c.json({ autorizado: false, motivo: 'Usuario inactivo' }, 403);
      }
      const membership = await prisma.membership.findUnique({
        where: { userId_spaceId: { userId: usuario.id, spaceId } },
      });
      if (!membership || !membership.activo || membership.estadoAprobacion !== 'aprobado') {
        await prisma.ingreso.create({
          data: { userId: usuario.id, spaceId, tipo, metodo, autorizado: false, motivoRechazo: 'Sin membresía activa', registradoPor: guardiaId },
        });
        return c.json({ autorizado: false, motivo: 'Sin membresía activa en este space' }, 403);
      }
      const ingreso = await prisma.ingreso.create({
        data: { userId: usuario.id, spaceId, tipo, metodo, autorizado: true, registradoPor: guardiaId },
      });
      return c.json({ autorizado: true, tipo_acceso: 'vecino', ingreso: { id: ingreso.id, tipo: ingreso.tipo, createdAt: ingreso.createdAt }, usuario: { id: usuario.id, nombre: usuario.nombre, numeroCasa: usuario.numeroCasa } });
    }

    // 2. Buscar como invitación
    const invitacion = await prisma.invitacion.findFirst({ where: { qrCode, spaceId } });

    if (invitacion) {
      if (!invitacion.activo) {
        return c.json({ autorizado: false, motivo: 'Invitación revocada' }, 403);
      }
      if (invitacion.fechaVence && new Date(invitacion.fechaVence) < new Date()) {
        return c.json({ autorizado: false, motivo: 'Invitación vencida' }, 403);
      }
      if (invitacion.usosActuales >= invitacion.usosMaximos) {
        return c.json({ autorizado: false, motivo: 'Invitación sin usos disponibles' }, 403);
      }
      await prisma.invitacion.update({
        where: { id: invitacion.id },
        data: { usosActuales: { increment: 1 } },
      });
      const ingreso = await prisma.ingreso.create({
        data: { userId: invitacion.vecinoId, spaceId, tipo, metodo, autorizado: true, registradoPor: guardiaId, invitacionId: invitacion.id },
      });
      return c.json({ autorizado: true, tipo_acceso: invitacion.tipo, ingreso: { id: ingreso.id, tipo: ingreso.tipo, createdAt: ingreso.createdAt }, usuario: { nombre: invitacion.nombre, dni: invitacion.dni, patente: invitacion.patente } });
    }

    // 3. Buscar como personal permanente
    const personalItem = await prisma.personalPermanente.findFirst({ where: { qrCode, spaceId, activo: true } });

    if (personalItem) {
      // Verificar permiso para el día actual
      const diaSemana = new Date().getDay();
      const permiso = await prisma.permisoHorario.findFirst({
        where: { personalId: personalItem.id, diaSemana, activo: true },
      });
      if (!permiso) {
        await prisma.ingreso.create({
          data: { userId: personalItem.vecinoId, spaceId, tipo, metodo, autorizado: false, motivoRechazo: 'Sin permiso para hoy', registradoPor: guardiaId, personalId: personalItem.id },
        });
        return c.json({ autorizado: false, motivo: 'Personal sin permiso para hoy' }, 403);
      }
      const ingreso = await prisma.ingreso.create({
        data: { userId: personalItem.vecinoId, spaceId, tipo, metodo, autorizado: true, registradoPor: guardiaId, personalId: personalItem.id },
      });
      return c.json({ autorizado: true, tipo_acceso: 'personal', ingreso: { id: ingreso.id, tipo: ingreso.tipo, createdAt: ingreso.createdAt }, usuario: { nombre: personalItem.nombre, dni: personalItem.dni, tipo: personalItem.tipo } });
    }

    // QR no reconocido
    await prisma.ingreso.create({
      data: { userId: 'unknown', spaceId, tipo, metodo, autorizado: false, motivoRechazo: 'QR no reconocido', registradoPor: guardiaId },
    });
    return c.json({ autorizado: false, motivo: 'QR no reconocido' }, 403);
  }
);

// GET /accesos/mis-ingresos — historial del usuario autenticado
accesos.get('/mis-ingresos', async (c) => {
  const { userId } = c.get('user');

  const ingresos = await prisma.ingreso.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ ingresos });
});

// GET /accesos/space/:id — historial del space (guardia/admin)
accesos.get(
  '/space/:id',
  requireRol('guardia', 'admin', 'super_admin'),
  async (c) => {
    const spaceId = c.req.param('id');
    const { page = '1', limit = '50' } = c.req.query();

    const skip = (Number(page) - 1) * Number(limit);

    const [ingresos, total] = await Promise.all([
      prisma.ingreso.findMany({
        where: { spaceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.ingreso.count({ where: { spaceId } }),
    ]);

    // Enriquecer con datos del usuario
    const userIds = [...new Set(ingresos.map((i) => i.userId).filter((id) => id !== 'unknown'))];
    const usuarios = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true, email: true, numeroCasa: true },
    });
    const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.id, u]));

    const ingresosConUsuario = ingresos.map((i) => ({
      ...i,
      usuario: usuariosMap[i.userId] ?? null,
    }));

    return c.json({
      ingresos: ingresosConUsuario,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  }
);

export default accesos;
