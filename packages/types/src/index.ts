// Tipos compartidos entre api, web y mobile

export type Rol = 'vecino' | 'guardia' | 'admin' | 'super_admin';

export type EstadoAprobacion = 'pendiente' | 'aprobado' | 'rechazado';

export type SpaceType = 'residential' | 'gym' | 'club' | 'coworking' | 'event';

export type User = {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  numeroCasa: string | null;
  rol: Rol;
  barrioId: string | null;
  activo: boolean;
  estadoAprobacion: EstadoAprobacion;
  expoPushToken: string | null;
  qrCode: string | null;
  esTitular: boolean;
  titularId: string | null;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: Pick<User, 'id' | 'email' | 'nombre' | 'rol' | 'barrioId' | 'estadoAprobacion'>;
};

export type RegisterInput = {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type Plan = 'free' | 'basic' | 'pro';

export type Organization = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  plan: Plan;
  activo: boolean;
  ownerId: string;
  createdAt: string;
};

export type Space = {
  id: string;
  nombre: string;
  direccion: string | null;
  spaceType: SpaceType;
  precioPorCasa: number | null;
  activo: boolean;
  codigoInvitacion: string | null;
  organizationId: string;
  createdAt: string;
};

export type TipoIngreso = 'entrada' | 'salida';

export type MetodoIngreso = 'qr' | 'manual' | 'facial';

export type Ingreso = {
  id: string;
  userId: string;
  spaceId: string;
  tipo: TipoIngreso;
  metodo: MetodoIngreso;
  autorizado: boolean;
  motivoRechazo: string | null;
  registradoPor: string | null;
  createdAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  spaceId: string;
  rol: Rol;
  numeroUnidad: string | null;
  estadoAprobacion: EstadoAprobacion;
  activo: boolean;
  fechaSolicitud: string;
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
};
