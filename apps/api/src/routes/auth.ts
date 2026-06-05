import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  nombre: z.string().min(1, 'Nombre requerido'),
  telefono: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string, email: string, rol: string) {
  return jwt.sign(
    { userId, email, rol },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

// POST /auth/register
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, nombre, telefono } = c.req.valid('json');

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return c.json({ error: 'El email ya está registrado' }, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      nombre,
      telefono,
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      estadoAprobacion: true,
      createdAt: true,
    },
  });

  const token = signToken(user.id, user.email, user.rol);

  return c.json({ token, user }, 201);
});

// POST /auth/login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return c.json({ error: 'Email o contraseña incorrectos' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return c.json({ error: 'Email o contraseña incorrectos' }, 401);
  }

  if (!user.activo) {
    return c.json({ error: 'Cuenta desactivada' }, 403);
  }

  const token = signToken(user.id, user.email, user.rol);

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      barrioId: user.barrioId,
      estadoAprobacion: user.estadoAprobacion,
    },
  });
});

// GET /auth/me
auth.get('/me', authMiddleware, async (c) => {
  const { userId } = c.get('user');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      numeroCasa: true,
      rol: true,
      barrioId: true,
      activo: true,
      estadoAprobacion: true,
      expoPushToken: true,
      qrCode: true,
      esTitular: true,
      titularId: true,
      createdAt: true,
    },
  });

  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  return c.json({ user });
});

export default auth;
