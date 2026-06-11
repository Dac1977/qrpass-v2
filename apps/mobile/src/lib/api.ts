import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'qrpass_token';

// ─── Token storage ────────────────────────────────────────────────────────────

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  set: async (token: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(TOKEN_KEY, token); return; }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  remove: async (): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(TOKEN_KEY); return; }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

// ─── Base fetcher ─────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await tokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRol = 'vecino' | 'guardia' | 'admin' | 'super_admin';

export type User = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  numeroCasa: string | null;
  rol: UserRol;
  barrioId: string | null;
  activo: boolean;
  estadoAprobacion: string | null;
  expoPushToken: string | null;
  qrCode: string | null;
  esTitular: boolean;
  titularId: string | null;
  createdAt: string;
};

export type SpaceType = 'residential' | 'gym' | 'club' | 'event' | 'coworking' | 'other';

export type Space = {
  id: string;
  nombre: string;
  direccion: string | null;
  spaceType: SpaceType;
  organizationId: string | null;
  codigoInvitacion: string | null;
  activo: boolean;
  createdAt: string;
};

export type Membership = {
  spaceId: string;
  spaceName: string;
  spaceType: SpaceType;
  rol: UserRol;
  numeroUnidad: string | null;
  activo: boolean;
  estadoAprobacion: string;
  codigoInvitacion: string | null;
};

export type Aviso = {
  id: string;
  spaceId: string;
  autorId: string;
  titulo: string;
  contenido: string;
  importante: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Expensa = {
  id: string;
  spaceId: string;
  periodo: string;
  descripcion: string;
  monto: number;
  fechaVencimiento: string | null;
  activo: boolean;
  createdAt: string;
};

export type Pago = {
  id: string;
  expensaId: string;
  userId: string;
  monto: number;
  metodoPago: 'mercadopago' | 'transferencia';
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  comprobanteUrl: string | null;
  observaciones: string | null;
  createdAt: string;
};

export type Amenity = {
  id: string;
  spaceId: string;
  nombre: string;
  descripcion: string | null;
  capacidad: number | null;
  horaApertura: string;
  horaCierre: string;
  turnosConfig: { id: string; etiqueta: string | null; hora_inicio: string; hora_fin: string }[] | null;
  requiereAprobacion: boolean;
  precioReserva: number;
  activo: boolean;
  createdAt: string;
};

export type Reserva = {
  id: string;
  amenityId: string;
  userId: string;
  spaceId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'confirmada' | 'pendiente' | 'cancelada' | 'rechazada';
  notas: string | null;
  createdAt: string;
};

export type Evento = {
  id: string;
  spaceId: string;
  organizadorId: string;
  nombre: string;
  descripcion: string | null;
  fechaEvento: string;
  activo: boolean;
  createdAt: string;
};

export type EventoLink = {
  id: string;
  eventoId: string;
  token: string;
  permiteAcompanantes: boolean;
  maxAcompanantes: number;
  requiereDni: boolean;
  usosPorPersona: number;
  habilitado: boolean;
  createdAt: string;
};

export type EventoSolicitud = {
  id: string;
  eventLinkId: string;
  token: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  acompanantes: number;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  qrCode: string;
  usosPermitidos: number;
  usosActuales: number;
  createdAt: string;
};

export type Encuesta = {
  id: string;
  spaceId: string;
  autorId: string;
  titulo: string;
  descripcion: string | null;
  opciones: string[];
  multiple: boolean;
  activa: boolean;
  fechaCierre: string | null;
  resultados: number[];
  miVoto: number[] | null;
  createdAt: string;
};

export type Voto = {
  id: string;
  encuestaId: string;
  vecinoId: string;
  opciones: number[];
  createdAt: string;
};

export type Reclamo = {
  id: string;
  spaceId: string;
  userId: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  estado: 'pendiente' | 'en_proceso' | 'resuelto';
  foto: string | null;
  respuesta: string | null;
  adminId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonalPermanente = {
  id: string;
  spaceId: string;
  vecinoId: string;
  nombre: string;
  dni: string | null;
  foto: string | null;
  tipo: string;
  qrCode: string;
  activo: boolean;
  permisos: PermisoHorario[];
  createdAt: string;
};

export type PermisoHorario = {
  id: string;
  personalId: string;
  vecinoId: string;
  diaSemana: number;
  horaEntrada: string | null;
  horaSalida: string | null;
  activo: boolean;
};

export type Invitacion = {
  id: string;
  spaceId: string;
  vecinoId: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  patente: string | null;
  tipo: 'visita' | 'delivery';
  qrCode: string;
  usosMaximos: number;
  usosActuales: number;
  fechaVence: string | null;
  activo: boolean;
  createdAt: string;
};

export type Contacto = {
  id: string;
  vecinoId: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  patente: string | null;
  foto: string | null;
  createdAt: string;
};

export type AlertaEmergencia = {
  id: string;
  spaceId: string;
  vecinoId: string;
  tipo: 'emergencia' | 'incendio' | 'robo' | 'medica' | 'otro';
  mensaje: string | null;
  latitud: number | null;
  longitud: number | null;
  atendida: boolean;
  atendidaPor: string | null;
  createdAt: string;
};

export type ValidacionQR = {
  autorizado: boolean;
  motivo?: string;
  tipo_acceso?: 'vecino' | 'visita' | 'delivery' | 'personal';
  ingreso?: { id: string; tipo: string; createdAt: string };
  usuario?: { id?: string; nombre: string; numeroCasa?: string; dni?: string; patente?: string; tipo?: string };
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    email: string;
    password: string;
    nombre: string;
    telefono?: string;
    codigoInvitacion?: string;
    numeroUnidad?: string;
    onboarding?: boolean;
  }) =>
    apiFetch<{ token: string; user: User; space?: { id: string; nombre: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => apiFetch<{ user: User }>('/auth/me'),

  updatePushToken: (token: string) =>
    apiFetch('/users/me/push-token', { method: 'PATCH', body: JSON.stringify({ expoPushToken: token }) }),
};

// ─── Spaces ───────────────────────────────────────────────────────────────────

export const spacesApi = {
  getMemberships: () => apiFetch<{ memberships: Membership[] }>('/spaces/mis-memberships'),
  getSpace: (id: string) => apiFetch<{ space: Space }>(`/spaces/${id}`),
  byCode: (codigo: string) =>
    apiFetch<{ space: { id: string; nombre: string; spaceType: SpaceType } }>(`/spaces/by-code/${codigo.toUpperCase()}`),
  join: (codigoInvitacion: string, numeroUnidad?: string) =>
    apiFetch('/spaces/join', { method: 'POST', body: JSON.stringify({ codigoInvitacion, numeroUnidad }) }),
};

// ─── Avisos ───────────────────────────────────────────────────────────────────

export const avisosApi = {
  listar: (spaceId: string) => apiFetch<{ avisos: Aviso[] }>(`/avisos/space/${spaceId}`),
  crear: (data: { spaceId: string; titulo: string; contenido: string; importante?: boolean }) =>
    apiFetch<{ aviso: Aviso }>('/avisos', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: Partial<Aviso>) =>
    apiFetch<{ aviso: Aviso }>(`/avisos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch(`/avisos/${id}`, { method: 'DELETE' }),
};

// ─── Expensas ─────────────────────────────────────────────────────────────────

export const expensasApi = {
  listar: (spaceId: string) => apiFetch<{ expensas: Expensa[] }>(`/expensas/space/${spaceId}`),
  misPagos: (expensaId: string) => apiFetch<{ pagos: Pago[] }>(`/expensas/${expensaId}/mis-pagos`),
  registrarPago: (expensaId: string, data: { monto: number; metodoPago: string; comprobanteUrl?: string; observaciones?: string }) =>
    apiFetch<{ pago: Pago }>(`/expensas/${expensaId}/pagar`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Amenities / Reservas ─────────────────────────────────────────────────────

export const amenitiesApi = {
  listar: (spaceId: string) => apiFetch<{ amenities: Amenity[] }>(`/amenities/space/${spaceId}`),
  misReservas: () => apiFetch<{ reservas: Reserva[] }>('/reservas/mis'),
  reservasPorFecha: (amenityId: string, fecha: string) =>
    apiFetch<{ reservas: Reserva[] }>(`/reservas/amenity/${amenityId}?fecha=${fecha}`),
  crear: (data: { amenityId: string; spaceId: string; fecha: string; horaInicio: string; horaFin: string; notas?: string }) =>
    apiFetch<{ reserva: Reserva }>('/reservas', { method: 'POST', body: JSON.stringify(data) }),
  cancelar: (id: string) => apiFetch(`/reservas/${id}`, { method: 'DELETE' }),
};

// ─── Eventos ──────────────────────────────────────────────────────────────────

export const eventosApi = {
  listar: (spaceId: string) => apiFetch<{ events: Evento[] }>(`/events/space/${spaceId}`),
  crear: (data: { spaceId: string; nombre: string; descripcion?: string; fechaEvento: string }) =>
    apiFetch<{ event: Evento }>('/events', { method: 'POST', body: JSON.stringify(data) }),
  crearLink: (eventoId: string, data: object) =>
    apiFetch<{ link: EventoLink }>(`/events/${eventoId}/links`, { method: 'POST', body: JSON.stringify(data) }),
  solicitarAcceso: (token: string, data: object) =>
    apiFetch<{ solicitud: EventoSolicitud }>(`/events/solicitudes/${token}`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Reclamos ─────────────────────────────────────────────────────────────────

export const reclamosApi = {
  mis: () => apiFetch<{ reclamos: Reclamo[] }>('/reclamos/mis'),
  listarSpace: (spaceId: string, params?: { estado?: string; categoria?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ reclamos: (Reclamo & { usuario: { nombre: string; numeroCasa: string } | null })[] }>(
      `/reclamos/space/${spaceId}${q ? `?${q}` : ''}`
    );
  },
  crear: (data: { spaceId: string; titulo: string; descripcion: string; categoria?: string; foto?: string }) =>
    apiFetch<{ reclamo: Reclamo }>('/reclamos', { method: 'POST', body: JSON.stringify(data) }),
  responder: (id: string, data: { respuesta: string; estado?: 'en_proceso' | 'resuelto' }) =>
    apiFetch<{ reclamo: Reclamo }>(`/reclamos/${id}/responder`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch(`/reclamos/${id}`, { method: 'DELETE' }),
};

// ─── Personal ─────────────────────────────────────────────────────────────────

export const personalApi = {
  mis: () => apiFetch<{ personal: PersonalPermanente[] }>('/personal/mis'),
  crear: (data: {
    spaceId: string;
    nombre: string;
    dni?: string;
    foto?: string;
    tipo?: string;
    permisos?: { diaSemana: number; horaEntrada?: string; horaSalida?: string }[];
  }) => apiFetch<{ personal: PersonalPermanente }>('/personal', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: object) =>
    apiFetch<{ personal: PersonalPermanente }>(`/personal/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch(`/personal/${id}`, { method: 'DELETE' }),
};

// ─── Invitaciones ─────────────────────────────────────────────────────────────

export const invitacionesApi = {
  mis: (spaceId?: string) =>
    apiFetch<{ invitaciones: Invitacion[] }>(`/invitaciones/mis${spaceId ? `?spaceId=${spaceId}` : ''}`),
  crear: (data: {
    spaceId: string;
    nombre: string;
    dni?: string;
    telefono?: string;
    patente?: string;
    tipo?: 'visita' | 'delivery';
    usosMaximos?: number;
    horasVigencia?: number;
  }) => apiFetch<{ invitacion: Invitacion }>('/invitaciones', { method: 'POST', body: JSON.stringify(data) }),
  revocar: (id: string) => apiFetch(`/invitaciones/${id}`, { method: 'DELETE' }),
};

// ─── Contactos ────────────────────────────────────────────────────────────────

export const contactosApi = {
  listar: () => apiFetch<{ contactos: Contacto[] }>('/contactos'),
  crear: (data: { nombre: string; dni?: string; telefono?: string; patente?: string; foto?: string }) =>
    apiFetch<{ contacto: Contacto }>('/contactos', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id: string, data: Partial<Contacto>) =>
    apiFetch<{ contacto: Contacto }>(`/contactos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar: (id: string) => apiFetch(`/contactos/${id}`, { method: 'DELETE' }),
};

// ─── Encuestas ────────────────────────────────────────────────────────────────

export const encuestasApi = {
  listar: (spaceId: string) => apiFetch<{ encuestas: Encuesta[] }>(`/encuestas/space/${spaceId}`),
  votar: (id: string, opciones: number[]) =>
    apiFetch<{ voto: Voto }>(`/encuestas/${id}/votar`, { method: 'POST', body: JSON.stringify({ opciones }) }),
};

// ─── Accesos ──────────────────────────────────────────────────────────────────

export const accesosApi = {
  verificar: (data: { qrCode: string; spaceId: string; tipo?: string; metodo?: string }) =>
    apiFetch<ValidacionQR>('/accesos/verificar', { method: 'POST', body: JSON.stringify(data) }),
  historial: (spaceId: string, limit = 50) =>
    apiFetch(`/accesos/space/${spaceId}?limit=${limit}`),
  misIngresos: () => apiFetch('/accesos/mis-ingresos'),
};

// ─── Alertas ──────────────────────────────────────────────────────────────────

export const alertasApi = {
  enviar: (data: { spaceId: string; tipo: string; mensaje?: string; latitud?: number; longitud?: number }) =>
    apiFetch<{ alerta: AlertaEmergencia }>('/alertas', { method: 'POST', body: JSON.stringify(data) }),
  listar: (spaceId: string) => apiFetch<{ alertas: AlertaEmergencia[] }>(`/alertas/space/${spaceId}`),
  atender: (id: string) => apiFetch(`/alertas/${id}/atender`, { method: 'PATCH' }),
};

// ─── Users (admin) ────────────────────────────────────────────────────────────

export const usersApi = {
  listarSpace: (spaceId: string) => apiFetch<{ users: User[] }>(`/users/space/${spaceId}`),
  aprobar: (userId: string, spaceId: string) =>
    apiFetch(`/users/${userId}/approve`, { method: 'PATCH', body: JSON.stringify({ spaceId }) }),
  actualizar: (userId: string, data: Partial<User>) =>
    apiFetch<{ user: User }>(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
