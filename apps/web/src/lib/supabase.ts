// Supabase eliminado — usar api.ts para todas las operaciones

export type Profile = {
  id: string;
  email: string;
  nombre: string;
  rol: 'vecino' | 'guardia' | 'admin' | 'super_admin';
  barrio_id: string | null;
  numero_casa: string | null;
  telefono: string | null;
};

export type Invitacion = {
  id: string;
  vecino_id: string;
  nombre_invitado: string;
  dni_invitado: string | null;
  telefono_invitado: string | null;
  patente: string | null;
  qr_code: string;
  valido_hasta: string;
  usos_permitidos: number;
  usos_actuales: number;
  activo: boolean;
  created_at: string;
  vecino?: {
    nombre: string;
    numero_casa: string | null;
  };
};

export type ValidacionQR = {
  id: string;
  invitacion_id: string;
  guardia_id: string;
  resultado: 'aprobado' | 'rechazado' | 'excepcion';
  motivo: string | null;
  created_at: string;
};
