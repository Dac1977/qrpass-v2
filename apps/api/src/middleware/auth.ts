import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';

export type JwtPayload = {
  userId: string;
  email: string;
  rol: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Token inválido o expirado' }, 401);
  }
});

export const requireRol = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.rol)) {
      return c.json({ error: 'Sin permisos' }, 403);
    }
    await next();
  });
