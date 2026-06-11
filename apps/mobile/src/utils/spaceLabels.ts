import { SpaceType } from '../lib/api';

export type SpaceLabels = {
  members: string;
  member: string;
  space: string;
  unit: string;
  myUnit: string;
  staff: string;
  access: string;
  spaceIcon: string;
  payments: string;
  paymentSingular: string;
  adminLabel: string;
};

const labelMap: Record<SpaceType, SpaceLabels> = {
  residential: {
    members: 'Vecinos',
    member: 'Vecino',
    space: 'Barrio',
    unit: 'Casa',
    myUnit: 'Mi Casa',
    staff: 'Guardias',
    access: 'Ingreso',
    spaceIcon: '🏘️',
    payments: 'Expensas',
    paymentSingular: 'expensa',
    adminLabel: 'Administrador del Barrio',
  },
  gym: {
    members: 'Socios',
    member: 'Socio',
    space: 'Gimnasio',
    unit: 'Casillero',
    myUnit: 'Mi Casillero',
    staff: 'Personal',
    access: 'Check-in',
    spaceIcon: '🏋️',
    payments: 'Cuotas',
    paymentSingular: 'cuota',
    adminLabel: 'Administrador del Gimnasio',
  },
  club: {
    members: 'Socios',
    member: 'Socio',
    space: 'Club',
    unit: 'N° Socio',
    myUnit: 'Mi N° Socio',
    staff: 'Personal',
    access: 'Ingreso',
    spaceIcon: '🏆',
    payments: 'Cuotas',
    paymentSingular: 'cuota',
    adminLabel: 'Administrador del Club',
  },
  event: {
    members: 'Asistentes',
    member: 'Asistente',
    space: 'Evento',
    unit: 'Entrada',
    myUnit: 'Mi Entrada',
    staff: 'Staff',
    access: 'Check-in',
    spaceIcon: '🎪',
    payments: 'Tickets',
    paymentSingular: 'ticket',
    adminLabel: 'Administrador del Evento',
  },
  coworking: {
    members: 'Miembros',
    member: 'Miembro',
    space: 'Coworking',
    unit: 'Escritorio',
    myUnit: 'Mi Escritorio',
    staff: 'Staff',
    access: 'Acceso',
    spaceIcon: '💼',
    payments: 'Alquiler',
    paymentSingular: 'alquiler',
    adminLabel: 'Administrador del Coworking',
  },
  other: {
    members: 'Miembros',
    member: 'Miembro',
    space: 'Espacio',
    unit: 'N° Miembro',
    myUnit: 'Mi Unidad',
    staff: 'Personal',
    access: 'Ingreso',
    spaceIcon: '🏢',
    payments: 'Cobros',
    paymentSingular: 'cobro',
    adminLabel: 'Administrador del Espacio',
  },
};

const defaultLabels = labelMap.residential;

export function getSpaceLabels(spaceType?: SpaceType | string | null): SpaceLabels {
  return labelMap[(spaceType as SpaceType) ?? 'residential'] ?? defaultLabels;
}

export function getSpaceTypeLabel(spaceType?: SpaceType | string | null): string {
  const labels: Record<string, string> = {
    residential: 'Residencial',
    gym: 'Gimnasio',
    club: 'Club',
    event: 'Evento',
    coworking: 'Coworking',
    other: 'Otro',
  };
  return labels[spaceType ?? ''] ?? 'Residencial';
}
