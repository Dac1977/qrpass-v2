import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRouter from './routes/auth';
import organizationsRouter from './routes/organizations';
import spacesRouter from './routes/spaces';
import accesosRouter from './routes/accesos';
import alertasRouter from './routes/alertas';
import avisosRouter from './routes/avisos';
import expensasRouter from './routes/expensas';
import amenitiesRouter from './routes/amenities';
import reservasRouter from './routes/reservas';
import usersRouter from './routes/users';
import eventsRouter from './routes/events';
import chatRouter from './routes/chat';
import reclamosRouter from './routes/reclamos';
import personalRouter from './routes/personal';
import invitacionesRouter from './routes/invitaciones';
import contactosRouter from './routes/contactos';
import encuestasRouter from './routes/encuestas';
import terminalesRouter from './routes/terminales';
import faceRouter from './routes/face';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => c.json({ status: 'ok', app: 'QRPass API v2' }));

app.route('/auth', authRouter);
app.route('/organizations', organizationsRouter);
app.route('/spaces', spacesRouter);
app.route('/accesos', accesosRouter);
app.route('/alertas', alertasRouter);
app.route('/avisos', avisosRouter);
app.route('/expensas', expensasRouter);
app.route('/amenities', amenitiesRouter);
app.route('/reservas', reservasRouter);
app.route('/users', usersRouter);
app.route('/events', eventsRouter);
app.route('/chat', chatRouter);
app.route('/reclamos', reclamosRouter);
app.route('/personal', personalRouter);
app.route('/invitaciones', invitacionesRouter);
app.route('/contactos', contactosRouter);
app.route('/encuestas', encuestasRouter);
app.route('/terminales', terminalesRouter);
app.route('/face', faceRouter);

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

export default app;
