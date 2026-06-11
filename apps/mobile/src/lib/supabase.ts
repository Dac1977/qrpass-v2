// ⚠️ CAPA DE COMPATIBILIDAD — migrar imports a '../lib/api' pantalla por pantalla
// Este archivo re-exporta los tipos y funciones del nuevo cliente HTTP.
// El objeto `supabase` ya NO existe — las llamadas directas a supabase.from(...)
// deben reemplazarse por los métodos de api.ts en cada pantalla.

export {
  apiFetch,
  API_URL,
  authApi,
  spacesApi,
  avisosApi,
  expensasApi,
  amenitiesApi,
  eventosApi,
  reclamosApi,
  personalApi,
  invitacionesApi,
  contactosApi,
  encuestasApi,
  accesosApi,
  alertasApi,
  usersApi,
} from './api';

export type {
  User as Profile,
  Space,
  SpaceType,
  Membership,
  Aviso,
  Expensa,
  Pago,
  Amenity,
  Reserva,
  Evento,
  EventoLink,
  EventoSolicitud,
  Encuesta,
  Voto,
  Reclamo,
  PersonalPermanente,
  PermisoHorario,
  Invitacion,
  Contacto,
  AlertaEmergencia,
  ValidacionQR,
} from './api';

// Stub vacío para detectar usos pendientes de migrar en runtime
export const supabase = new Proxy({} as any, {
  get(_t, prop) {
    throw new Error(`[MIGRACIÓN PENDIENTE] supabase.${String(prop)}() ya no existe. Usá los métodos de api.ts`);
  },
});

