const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qrpass_token');
}

export function saveToken(token: string) {
  localStorage.setItem('qrpass_token', token);
}

export function clearToken() {
  localStorage.removeItem('qrpass_token');
  localStorage.removeItem('qrpass_user');
}

export function saveUser(user: object) {
  localStorage.setItem('qrpass_user', JSON.stringify(user));
}

export function getUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('qrpass_user');
  return raw ? (JSON.parse(raw) as T) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    const msg = typeof err.error === 'string'
      ? err.error
      : (err.message ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (data: { email: string; password: string; nombre: string; telefono?: string; codigoInvitacion?: string; numeroUnidad?: string; onboarding?: boolean }) =>
      request<{ token: string; user: any; space?: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    me: () => request<{ user: any }>('/auth/me'),
  },

  // ── Organizations ────────────────────────────────────────────────────────────
  organizations: {
    list: () => request<{ organizations: any[] }>('/organizations'),
    get: (id: string) => request<{ organization: any }>(`/organizations/${id}`),
    create: (data: object) => request<{ organization: any }>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) => request<{ organization: any }>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Spaces ───────────────────────────────────────────────────────────────────
  spaces: {
    list: () => request<{ spaces: any[] }>('/spaces'),
    get: (id: string) => request<{ space: any }>(`/spaces/${id}`),
    create: (data: object) => request<{ space: any }>('/spaces', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) => request<{ space: any }>(`/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    members: (id: string) => request<{ members: any[] }>(`/spaces/${id}/members`),
    byCode: (codigo: string) => request<{ space: any }>(`/spaces/by-code/${codigo}`),
    join: (data: { codigoInvitacion: string; numeroUnidad?: string }) =>
      request<{ membership: any; space: any }>('/spaces/join', { method: 'POST', body: JSON.stringify(data) }),
    approve: (spaceId: string, userId: string) =>
      request<{ membership: any }>(`/spaces/${spaceId}/members/${userId}/approve`, { method: 'PATCH' }),
    reject: (spaceId: string, userId: string) =>
      request<{ membership: any }>(`/spaces/${spaceId}/members/${userId}/reject`, { method: 'PATCH' }),
  },

  // ── Accesos ──────────────────────────────────────────────────────────────────
  accesos: {
    verificar: (data: { qrCode: string; spaceId: string; tipo?: string; metodo?: string }) =>
      request<{ autorizado: boolean; motivo?: string; usuario?: any; ingreso?: any }>('/accesos/verificar', { method: 'POST', body: JSON.stringify(data) }),
    misIngresos: () => request<{ ingresos: any[] }>('/accesos/mis-ingresos'),
    porSpace: (id: string, page = 1) => request<{ ingresos: any[]; total: number; totalPages: number }>(`/accesos/space/${id}?page=${page}`),
  },

  // ── Alertas ──────────────────────────────────────────────────────────────────
  alertas: {
    crear: (data: object) => request<{ alerta: any }>('/alertas', { method: 'POST', body: JSON.stringify(data) }),
    porSpace: (id: string, soloActivas = false) =>
      request<{ alertas: any[] }>(`/alertas/space/${id}?activas=${soloActivas}`),
    atender: (id: string) => request<{ alerta: any }>(`/alertas/${id}/atender`, { method: 'PATCH' }),
  },

  // ── Avisos ───────────────────────────────────────────────────────────────────
  avisos: {
    porSpace: (id: string) => request<{ avisos: any[] }>(`/avisos/space/${id}`),
    crear: (data: object) => request<{ aviso: any }>('/avisos', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id: string, data: object) => request<{ aviso: any }>(`/avisos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    eliminar: (id: string) => request<{ ok: boolean }>(`/avisos/${id}`, { method: 'DELETE' }),
  },

  // ── Users (super admin) ──────────────────────────────────────────────────────
  users: {
    list: (params?: { search?: string; rol?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ users: any[] }>(`/users${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<{ user: any }>(`/users/${id}`),
    update: (id: string, data: object) => request<{ user: any }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  },

  // ── Expensas ─────────────────────────────────────────────────────────────────
  expensas: {
    misExpensas: () => request<{ expensas: any[] }>('/expensas/mis-expensas'),
    porSpace: (id: string, params?: { mes?: number; anio?: number; estado?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ expensas: any[] }>(`/expensas/space/${id}${q ? `?${q}` : ''}`);
    },
    generar: (data: object) => request<{ creadas: number }>('/expensas/generar', { method: 'POST', body: JSON.stringify(data) }),
    pagar: (id: string) => request<{ expensa: any }>(`/expensas/${id}/pagar`, { method: 'PATCH' }),
  },

  // ── Amenities ────────────────────────────────────────────────────────────────
  amenities: {
    porSpace: (spaceId: string, opts?: { includeInactive?: boolean }) =>
      request<{ amenities: any[] }>(`/amenities/space/${spaceId}${opts?.includeInactive ? '?includeInactive=true' : ''}`),
    crear: (data: object) => request<{ amenity: any }>('/amenities', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id: string, data: object) => request<{ amenity: any }>(`/amenities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    toggle: (id: string, activo?: boolean) =>
      request<{ amenity: any }>(`/amenities/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify(activo === undefined ? {} : { activo }),
      }),
  },

  // ── Reservas ────────────────────────────────────────────────────────────────
  reservas: {
    mis: () => request<{ reservas: any[] }>('/reservas/mis'),
    crear: (data: object) => request<{ reserva: any }>('/reservas', { method: 'POST', body: JSON.stringify(data) }),
    porSpace: (spaceId: string) => request<{ reservas: any[] }>(`/reservas/space/${spaceId}`),
    actualizar: (id: string, data: object) => request<{ reserva: any }>(`/reservas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Events ────────────────────────────────────────────────────────────────────
  events: {
    getLink: (token: string) => request<{ id: string; eventId: string; token: string; permiteAcompanantes: boolean; maxAcompanantes: number; requiereDni: boolean; usosPorPersona: number; habilitado: boolean; event: { nombre: string; descripcion: string | null; fechaEvento: string } }>(`/events/links/${token}`),
    createSolicitud: (data: { eventLinkId: string; nombre: string; dni?: string; telefono?: string; acompanantes?: number }) =>
      request<{ solicitud: any }>('/events/solicitudes', { method: 'POST', body: JSON.stringify(data) }),
    getSolicitud: (token: string) => request<{ id: string; token: string; nombre: string; dni: string | null; telefono: string | null; acompanantes: number; estado: string; qrCode: string; usosPermitidos: number; usosActuales: number; acceptedAt: string | null; rejectedAt: string | null }>(`/events/solicitudes/${token}`),
  },

  // ── Chat ───────────────────────────────────────────────────────────────────────
  chat: {
    send: (data: { messages: { role: string; content: string }[] }) =>
      request<{ reply: string }>('/chat', { method: 'POST', body: JSON.stringify(data) }),
  },
};
