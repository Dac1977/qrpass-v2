// Tipos compartidos entre api, web y mobile
// Se irán completando al migrar cada módulo

export type Rol = 'vecino' | 'guardia' | 'admin' | 'super_admin';

export type EstadoAprobacion = 'pendiente' | 'aprobado' | 'rechazado';

export type SpaceType = 'residential' | 'gym' | 'club' | 'coworking' | 'event';
