import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRouter from './routes/auth';
import organizationsRouter from './routes/organizations';
import spacesRouter from './routes/spaces';
import accesosRouter from './routes/accesos';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => c.json({ status: 'ok', app: 'QRPass API v2' }));

app.route('/auth', authRouter);
app.route('/organizations', organizationsRouter);
app.route('/spaces', spacesRouter);
app.route('/accesos', accesosRouter);
// TODO: agregar routers al migrar cada módulo

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

export default app;
