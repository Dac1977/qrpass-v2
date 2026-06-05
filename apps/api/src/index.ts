import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRouter from './routes/auth';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => c.json({ status: 'ok', app: 'QRPass API v2' }));

app.route('/auth', authRouter);
// TODO: agregar routers al migrar cada módulo
// app.route('/users', usersRouter);
// app.route('/barrios', barriosRouter);

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

export default app;
