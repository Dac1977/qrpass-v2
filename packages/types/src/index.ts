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
