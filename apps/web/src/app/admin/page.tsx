'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, saveToken, saveUser, clearToken, getUser } from '@/lib/api';
import type { Profile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Ingreso = {
  id: string;
  created_at: string;
  nombre_visitante: string | null;
  dni_visitante: string | null;
  casa_destino: string | null;
  tipo: string | null;
  estado: string | null;
  barrio_id: string;
  guardia_id: string;
};

type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  rol: 'vecino' | 'guardia' | 'admin';
  barrio_id: string | null;
  numero_casa: string | null;
  telefono: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  estado_aprobacion?: string | null;
  fecha_solicitud?: string | null;
  fecha_aprobacion?: string | null;
  aprobado_por?: string | null;
  es_titular?: boolean;
};

type ConfigPagos = {
  id: string;
  barrio_id: string;
  mp_access_token: string | null;
  mp_habilitado: boolean;
  banco_nombre: string | null;
  banco_titular: string | null;
  banco_cbu: string | null;
  banco_alias: string | null;
  transferencia_habilitada: boolean;
};

type Expensa = {
  id: string;
  barrio_id: string;
  periodo: string;
  descripcion: string;
  monto: number;
  fecha_vencimiento: string | null;
  activo: boolean;
  created_at: string;
};

type TurnoConfigForm = {
  id: string;
  etiqueta: string;
  hora_inicio: string;
  hora_fin: string;
};

type BarreraGateConfig = {
  habilitado: boolean;
  tipo: 'ip_relay' | 'relay_usb' | 'ninguna';
  ip: string;
  puerto: number;
  endpoint_abrir: string;
  auth_token: string;
};

type Terminal = {
  id: string;
  nombre: string;
  activo: boolean;
};

type PuntoAcceso = {
  id: string;
  terminal_id: string;
  nombre: string;
  tipo: 'IN' | 'OUT' | 'BOTH';
  barrera: BarreraGateConfig | null;
  activo: boolean;
  orden: number;
};

type SpaceType = 'residential' | 'gym' | 'club' | 'coworking' | 'event' | string;

function getSpaceLabels(spaceType?: SpaceType) {
  switch (spaceType) {
    case 'gym': return {
      tipoEspacio: 'Gimnasio', adminLabel: 'Administrador del Gimnasio',
      miembro: 'socio', Miembro: 'Socio', miembros: 'socios', Miembros: 'Socios',
      unidad: 'N° Socio', Unidad: 'N° Socio', cobrosTab: '💰 Cuotas y Pagos',
      subCobros: 'cuotas', icon: '💪',
    };
    case 'club': return {
      tipoEspacio: 'Club', adminLabel: 'Administrador del Club',
      miembro: 'socio', Miembro: 'Socio', miembros: 'socios', Miembros: 'Socios',
      unidad: 'N° Socio', Unidad: 'N° Socio', cobrosTab: '💰 Cuotas y Pagos',
      subCobros: 'cuotas', icon: '🏊',
    };
    case 'coworking': return {
      tipoEspacio: 'Coworking', adminLabel: 'Administrador del Coworking',
      miembro: 'miembro', Miembro: 'Miembro', miembros: 'miembros', Miembros: 'Miembros',
      unidad: 'Puesto', Unidad: 'Puesto', cobrosTab: '💰 Alquileres y Pagos',
      subCobros: 'alquileres', icon: '💼',
    };
    case 'event': return {
      tipoEspacio: 'Evento', adminLabel: 'Administrador del Evento',
      miembro: 'participante', Miembro: 'Participante', miembros: 'participantes', Miembros: 'Participantes',
      unidad: 'Entrada', Unidad: 'Entrada', cobrosTab: '💰 Pagos',
      subCobros: 'pagos', icon: '🎉',
    };
    default: return {
      tipoEspacio: 'Barrio', adminLabel: 'Administrador del Barrio',
      miembro: 'vecino', Miembro: 'Vecino', miembros: 'vecinos', Miembros: 'Vecinos',
      unidad: 'Casa', Unidad: 'Casa', cobrosTab: '💰 Expensas y Pagos',
      subCobros: 'expensas', icon: '🏘️',
    };
  }
}

type AmenityFormState = {
  nombre: string;
  descripcion: string;
  capacidad: string;
  hora_apertura: string;
  hora_cierre: string;
  requiere_aprobacion: boolean;
  precio_reserva: string;
  turnos_config: TurnoConfigForm[];
};

const AMENITY_FORM_DEFAULT: AmenityFormState = {
  nombre: '',
  descripcion: '',
  capacidad: '',
  hora_apertura: '08:00',
  hora_cierre: '22:00',
  requiere_aprobacion: false,
  precio_reserva: '0',
  turnos_config: [],
};

const createEmptyAmenityForm = (): AmenityFormState => ({
  ...AMENITY_FORM_DEFAULT,
  turnos_config: [],
});

const generarTurnoId = () => Math.random().toString(36).slice(2, 9);

const normalizeAmenityFromApi = (amenity: any) => {
  const rawTurnos = Array.isArray(amenity?.turnos_config)
    ? amenity.turnos_config
    : Array.isArray(amenity?.turnosConfig)
      ? amenity.turnosConfig
      : [];

  const horaApertura = typeof (amenity?.hora_apertura ?? amenity?.horaApertura) === 'string'
    ? (amenity?.hora_apertura ?? amenity?.horaApertura)
    : '08:00';
  const horaCierre = typeof (amenity?.hora_cierre ?? amenity?.horaCierre) === 'string'
    ? (amenity?.hora_cierre ?? amenity?.horaCierre)
    : '22:00';

  return {
    ...amenity,
    hora_apertura: horaApertura.slice(0, 5),
    hora_cierre: horaCierre.slice(0, 5),
    requiere_aprobacion: amenity?.requiere_aprobacion ?? amenity?.requiereAprobacion ?? false,
    precio_reserva: String(amenity?.precio_reserva ?? amenity?.precioReserva ?? '0'),
    turnos_config: rawTurnos.map((turno: any, idx: number) => {
      const inicioRaw = turno?.hora_inicio ?? turno?.horaInicio ?? '08:00';
      const finRaw = turno?.hora_fin ?? turno?.horaFin ?? '09:00';
      return {
        id: turno?.id || `${generarTurnoId()}-${idx}`,
        etiqueta: turno?.etiqueta || '',
        hora_inicio: String(inicioRaw).slice(0, 5),
        hora_fin: String(finRaw).slice(0, 5),
      } as TurnoConfigForm;
    }),
  };
};

const mapReservaForAdmin = (reserva: any) => {
  const fecha = new Date(reserva?.fecha ?? reserva?.createdAt ?? Date.now());
  const horaInicio = reserva?.hora_inicio ?? reserva?.horaInicio ?? '';
  const horaFin = reserva?.hora_fin ?? reserva?.horaFin ?? '';

  return {
    ...reserva,
    fecha: fecha.toISOString().split('T')[0],
    hora_inicio: String(horaInicio).slice(0, 5),
    hora_fin: String(horaFin).slice(0, 5),
    amenity_nombre: reserva?.amenity_nombre ?? reserva?.amenity?.nombre ?? 'Amenity',
    vecino_nombre: reserva?.vecino_nombre ?? reserva?.vecino?.nombre ?? reserva?.vecino?.email ?? 'Vecino',
    vecino_casa: reserva?.vecino_casa ?? reserva?.vecino?.numeroCasa ?? null,
  };
};

type Pago = {
  id: string;
  expensa_id: string;
  vecino_id: string;
  monto: number;
  metodo_pago: 'mercadopago' | 'transferencia';
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  mp_payment_id: string | null;
  comprobante_url: string | null;
  observaciones: string | null;
  created_at: string;
  vecino_nombre?: string;
  vecino_casa?: string;
  periodo?: string;
};

type SolicitudPendiente = {
  id: string;
  email: string;
  nombre: string | null;
  barrio_id: string;
  barrio_nombre: string | null;
  numero_casa: string | null;
  telefono: string | null;
  estado_aprobacion: string;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  aprobado_por_uuid: string | null;
  aprobado_por_nombre: string | null;
  created_at: string;
};

export default function AdminPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [barrioInfo, setBarrioInfo] = useState<{ nombre: string; codigo_invitacion: string | null; space_type?: string; registrar_salidas?: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [misEspacios, setMisEspacios] = useState<{ space_id: string; space_nombre: string; space_type: string; codigo: string }[]>([]);
  const [switchingSpace, setSwitchingSpace] = useState(false);

  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [ingresosLoading, setIngresosLoading] = useState(true);
  const [ingresosError, setIngresosError] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);

  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudPendiente[]>([]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(true);
  const [solicitudesError, setSolicitudesError] = useState<string | null>(null);

  const [filtroCasa, setFiltroCasa] = useState('');
  const [filtroHoraInicio, setFiltroHoraInicio] = useState('00:00');
  const [filtroHoraFin, setFiltroHoraFin] = useState('23:59');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  const [filtroRol, setFiltroRol] = useState<'todos' | 'vecino' | 'guardia' | 'admin'>('todos');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserRol, setNewUserRol] = useState<'vecino' | 'guardia'>('vecino');
  const [newUserBarrioId, setNewUserBarrioId] = useState('');
  const [newUserNumeroCasa, setNewUserNumeroCasa] = useState('');
  const [newUserTelefono, setNewUserTelefono] = useState('');
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'general' | 'expensas' | 'amenities' | 'encuestas' | 'reclamos' | 'accesos'>('general');
  const [terminales, setTerminales] = useState<Terminal[]>([]);
  const [puntosAcceso, setPuntosAcceso] = useState<PuntoAcceso[]>([]);
  const [terminalExpandida, setTerminalExpandida] = useState<string | null>(null);
  const [showNuevaTerminal, setShowNuevaTerminal] = useState(false);
  const [nuevaTerminalNombre, setNuevaTerminalNombre] = useState('');
  const [showNuevoPunto, setShowNuevoPunto] = useState<string | null>(null);
  const [editandoPunto, setEditandoPunto] = useState<PuntoAcceso | null>(null);
  const [nuevoPunto, setNuevoPunto] = useState<{ nombre: string; tipo: 'IN' | 'OUT' | 'BOTH'; barrera: BarreraGateConfig }>({
    nombre: '', tipo: 'BOTH',
    barrera: { habilitado: false, tipo: 'ip_relay', ip: '', puerto: 80, endpoint_abrir: '/relay/on', auth_token: '' },
  });
  const [configPagos, setConfigPagos] = useState<ConfigPagos | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configForm, setConfigForm] = useState({
    mp_access_token: '',
    mp_habilitado: false,
    banco_nombre: '',
    banco_titular: '',
    banco_cbu: '',
    banco_alias: '',
    transferencia_habilitada: false,
  });
  const [expensas, setExpensas] = useState<Expensa[]>([]);
  const [expensasLoading, setExpensasLoading] = useState(false);
  const [showCrearExpensa, setShowCrearExpensa] = useState(false);
  const [editandoExpensa, setEditandoExpensa] = useState<Expensa | null>(null);
  const [nuevaExpensa, setNuevaExpensa] = useState({
    periodo: new Date().toISOString().slice(0, 7),
    descripcion: 'Expensas',
    monto: '',
    fecha_vencimiento: '',
  });
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [filtroExpensa, setFiltroExpensa] = useState<string>('todas');
  const [filtroPagoEstado, setFiltroPagoEstado] = useState<string>('todos');

  // Amenities
  const [amenities, setAmenities] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [showCrearAmenity, setShowCrearAmenity] = useState(false);
  const [nuevoAmenity, setNuevoAmenity] = useState<AmenityFormState>(() => createEmptyAmenityForm());
  const [editandoAmenity, setEditandoAmenity] = useState<any | null>(null);

  // Encuestas
  const [encuestas, setEncuestas] = useState<any[]>([]);
  const [showCrearEncuesta, setShowCrearEncuesta] = useState(false);
  const [nuevaEncuesta, setNuevaEncuesta] = useState({ titulo: '', descripcion: '', opciones: ['', ''], multiple: false, fecha_cierre: '' });
  const [resultadosEncuestas, setResultadosEncuestas] = useState<Record<string, Record<number, number>>>({});
  const [resultadosEncuestasLoading, setResultadosEncuestasLoading] = useState(false);

  // Reclamos
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [reclamosLoading, setReclamosLoading] = useState(false);
  const [filtroReclamo, setFiltroReclamo] = useState<'todos' | 'hoy' | 'ayer' | 'esta_semana' | 'este_mes'>('todos');
  const [filtroReclamoEstado, setFiltroReclamoEstado] = useState<'todos' | 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado'>('todos');
  const [reclamoRespuesta, setReclamoRespuesta] = useState<{ id: string; texto: string } | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      if (getToken()) {
        await fetchProfile();
        await cargarMisEspacios();
      }
      setReady(true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!profile?.barrio_id) return;
    cargarIngresos();
    cargarUsuarios();
    cargarSolicitudesPendientes();
    fetchBarrioInfo(profile.barrio_id);
  }, [profile?.barrio_id, filtroFechaInicio, filtroFechaFin]);

  useEffect(() => {
    if (profile?.rol === 'guardia') router.replace('/panel');
  }, [profile?.rol, router]);

  useEffect(() => {
    if (activeTab === 'expensas' && profile?.barrio_id) {
      cargarConfigPagos();
      cargarExpensas();
      cargarPagos();
    }
  }, [activeTab, profile?.barrio_id]);

  const cargarMisEspacios = async () => {
    try {
      const { spaces } = await api.spaces.list();
      setMisEspacios(spaces.map((s: any) => ({
        space_id: s.id,
        space_nombre: s.nombre,
        space_type: s.spaceType,
        codigo: s.codigoInvitacion ?? '',
      })));
    } catch { /* silencioso */ }
  };

  const switchSpace = async (spaceId: string) => {
    if (switchingSpace) return;
    setSwitchingSpace(true);
    try {
      await api.users.update(profile!.id, { barrioId: spaceId });
      await fetchProfile();
    } catch { /* silencioso */ }
    setSwitchingSpace(false);
  };

  const fetchProfile = async () => {
    try {
      const { user } = await api.auth.me();
      setProfile({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        barrio_id: user.barrioId ?? null,
        numero_casa: user.numeroCasa ?? null,
        telefono: user.telefono ?? null,
      } as Profile);
    } catch {
      clearToken();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { token, user } = await api.auth.login({ email: loginEmail, password: loginPassword });
      saveToken(token);
      saveUser(user);
      await fetchProfile();
      await cargarMisEspacios();
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect');
      if (redirectTo?.startsWith('/')) router.push(redirectTo);
    } catch {
      setLoginError('Email o contraseña incorrectos');
    }
    setLoginLoading(false);
  };

  const fetchBarrioInfo = async (spaceId: string) => {
    try {
      const { space } = await api.spaces.get(spaceId);
      setBarrioInfo({ nombre: space.nombre, codigo_invitacion: space.codigoInvitacion, space_type: space.spaceType, registrar_salidas: false });
    } catch { /* silencioso */ }
  };

  const toggleRegistrarSalidas = async (value: boolean) => {
    if (!profile?.barrio_id) return;
    setBarrioInfo(prev => prev ? { ...prev, registrar_salidas: value } : prev);
    await api.spaces.update(profile.barrio_id, { registrarSalidas: value }).catch(console.error);
  };

  const copyCodigo = async () => {
    if (!barrioInfo?.codigo_invitacion) return;
    try {
      await navigator.clipboard.writeText(barrioInfo.codigo_invitacion);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('copy codigo', error);
    }
  };

  const copyLink = async () => {
    if (!barrioInfo?.codigo_invitacion) return;
    const link = `${window.location.origin}/join/${barrioInfo.codigo_invitacion}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('copy link', error);
    }
  };

  const cargarIngresos = useCallback(async () => {
    if (!profile?.barrio_id) return;
    setIngresosLoading(true);
    setIngresosError(null);
    try {
      const { ingresos: data } = await api.accesos.porSpace(profile.barrio_id);
      setIngresos(data ?? []);
    } catch {
      setIngresosError('No pudimos cargar los ingresos');
    }
    setIngresosLoading(false);
  }, [profile?.barrio_id, filtroFechaInicio, filtroFechaFin]);

  const cargarUsuarios = useCallback(async () => {
    if (!profile?.barrio_id) return;
    setUsuariosLoading(true);
    setUsuariosError(null);
    try {
      const { members } = await api.spaces.members(profile.barrio_id);
      setUsuarios(members.filter((m: any) => m.estadoAprobacion === 'aprobado') ?? []);
    } catch {
      setUsuariosError('No pudimos cargar los usuarios');
    }
    setUsuariosLoading(false);
  }, [profile?.barrio_id]);

  const cargarSolicitudesPendientes = useCallback(async () => {
    if (!profile?.barrio_id) return;
    setSolicitudesLoading(true);
    setSolicitudesError(null);
    try {
      const { members } = await api.spaces.members(profile.barrio_id);
      setSolicitudesPendientes(members.filter((m: any) => m.estadoAprobacion === 'pendiente') ?? []);
    } catch {
      setSolicitudesError('No pudimos cargar las solicitudes pendientes');
    }
    setSolicitudesLoading(false);
  }, [profile?.barrio_id]);

  const aprobarUsuario = async (usuarioId: string) => {
    if (!profile?.barrio_id) return;
    try {
      await api.spaces.approve(profile.barrio_id, usuarioId);
      cargarSolicitudesPendientes();
      cargarUsuarios();
    } catch {
      alert('Error al aprobar usuario');
    }
  };

  const rechazarUsuario = async (usuarioId: string) => {
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;
    if (!profile?.barrio_id) return;
    try {
      await api.spaces.reject(profile.barrio_id, usuarioId);
      cargarSolicitudesPendientes();
      cargarUsuarios();
    } catch {
      alert('Error al rechazar usuario');
    }
  };

  const handleLogout = () => {
    clearToken();
    setProfile(null);
    router.push('/');
  };

  const crearUsuario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError(null);
    try {
      const { token } = await api.auth.register({
        email: newUserEmail,
        password: 'temporal123',
        nombre: newUserNombre,
        telefono: newUserTelefono || undefined,
      });
      // Unir al space actual
      const spaceId = newUserBarrioId || profile?.barrio_id;
      if (spaceId) {
        // El nuevo usuario necesita su propio token para unirse — hacemos el join desde el admin directamente
        // via approve después de join automático por código de invitación
      }
      setShowCreateUser(false);
      setNewUserEmail('');
      setNewUserNombre('');
      setNewUserRol('vecino');
      setNewUserBarrioId('');
      setNewUserNumeroCasa('');
      setNewUserTelefono('');
      cargarUsuarios();
    } catch (error) {
      setCreateUserError('No pudimos crear el usuario');
    }
    setCreateUserLoading(false);
  };

  // ── Expensas & Pagos functions ──

  const cargarConfigPagos = async () => {
    // TODO: implementar endpoint de configuración de pagos en la API
    setConfigLoading(false);
  };

  const guardarConfigPagos = async () => {
    // TODO: implementar endpoint de configuración de pagos en la API
    alert('Configuración de pagos: próximamente');
  };

  const cargarExpensas = async () => {
    if (!profile?.barrio_id) return;
    setExpensasLoading(true);
    try {
      const { expensas: data } = await api.expensas.porSpace(profile.barrio_id);
      setExpensas(data || []);
    } catch { /* silencioso */ }
    setExpensasLoading(false);
  };

  const crearExpensa = async () => {
    if (!profile?.barrio_id) return;
    if (!nuevaExpensa.monto || parseFloat(nuevaExpensa.monto) <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }
    try {
      await api.expensas.generar({
        spaceId: profile.barrio_id,
        periodo: nuevaExpensa.periodo,
        descripcion: nuevaExpensa.descripcion || 'Expensas',
        monto: parseFloat(nuevaExpensa.monto),
        fechaVencimiento: nuevaExpensa.fecha_vencimiento || undefined,
      });
      setShowCrearExpensa(false);
      setNuevaExpensa({ periodo: new Date().toISOString().slice(0, 7), descripcion: 'Expensas', monto: '', fecha_vencimiento: '' });
      cargarExpensas();
    } catch (err: any) {
      alert('Error al crear expensa: ' + (err.message || ''));
    }
  };

  const toggleExpensaActiva = async (_expensaId: string, _activo: boolean) => {
    alert('Próximamente');
  };

  const editarExpensa = async () => {
    alert('Edición de expensas: próximamente');
  };

  const eliminarExpensa = async (_expensaId: string) => {
    alert('Eliminación de expensas: próximamente');
  };

  const cargarPagos = async () => {
    setPagosLoading(false);
    // TODO: implementar endpoint de pagos
  };

  const actualizarEstadoPago = async (_pagoId: string, _nuevoEstado: 'aprobado' | 'rechazado') => {
    alert('Gestión de pagos: próximamente');
  };

  const stats = useMemo(() => ({
    totalVecinos: usuarios.filter((u) => u.rol === 'vecino').length,
    totalGuardias: usuarios.filter((u) => u.rol === 'guardia').length,
    pendientes: solicitudesPendientes.length,
    ingresosHoy: ingresos.filter((i) => {
      const hoy = new Date().toDateString();
      return new Date(i.created_at).toDateString() === hoy;
    }).length,
  }), [usuarios, solicitudesPendientes, ingresos]);

  const pagosFiltrados = useMemo(() => {
    return pagos.filter((p) => {
      const coincideExpensa = filtroExpensa === 'todas' || p.expensa_id === filtroExpensa;
      const coincideEstado = filtroPagoEstado === 'todos' || p.estado === filtroPagoEstado;
      return coincideExpensa && coincideEstado;
    });
  }, [pagos, filtroExpensa, filtroPagoEstado]);

  // === AMENITIES ===
  const cargarAmenities = async () => {
    if (!profile?.barrio_id) return;
    try {
      const { amenities: data } = await api.amenities.porSpace(profile.barrio_id, { includeInactive: true });
      setAmenities((data || []).map(normalizeAmenityFromApi));
    } catch (error) {
      console.error('Error al cargar amenities', error);
    }
  };
  const cargarReservas = async () => {
    if (!profile?.barrio_id) return;
    try {
      const { reservas: data } = await api.reservas.porSpace(profile.barrio_id);
      setReservas((data || []).map(mapReservaForAdmin));
    } catch (error) {
      console.error('Error al cargar reservas', error);
    }
  };

  const resetAmenityForm = () => {
    setNuevoAmenity(createEmptyAmenityForm());
    setEditandoAmenity(null);
  };

  const cerrarModalAmenity = () => {
    setShowCrearAmenity(false);
    resetAmenityForm();
  };

  const abrirCrearAmenity = () => {
    resetAmenityForm();
    setShowCrearAmenity(true);
  };

  const abrirEditarAmenity = (amenity: any) => {
    setEditandoAmenity(amenity);
    setNuevoAmenity({
      nombre: amenity.nombre || '',
      descripcion: amenity.descripcion || '',
      capacidad: amenity.capacidad ? String(amenity.capacidad) : '',
      hora_apertura: amenity.hora_apertura || '08:00',
      hora_cierre: amenity.hora_cierre || '22:00',
      requiere_aprobacion: !!amenity.requiere_aprobacion,
      precio_reserva: amenity.precio_reserva ? String(amenity.precio_reserva) : '0',
      turnos_config: Array.isArray(amenity.turnos_config)
        ? amenity.turnos_config.map((turno: any) => ({
            id: turno.id || generarTurnoId(),
            etiqueta: turno.etiqueta || '',
            hora_inicio: turno.hora_inicio?.slice(0, 5) || '08:00',
            hora_fin: turno.hora_fin?.slice(0, 5) || '09:00',
          }))
        : [],
    });
    setShowCrearAmenity(true);
  };

  const agregarTurno = () => {
    setNuevoAmenity((prev) => ({
      ...prev,
      turnos_config: [
        ...prev.turnos_config,
        { id: generarTurnoId(), etiqueta: '', hora_inicio: '08:00', hora_fin: '09:00' },
      ],
    }));
  };

  const actualizarTurno = (id: string, campo: 'hora_inicio' | 'hora_fin' | 'etiqueta', valor: string) => {
    setNuevoAmenity((prev) => ({
      ...prev,
      turnos_config: prev.turnos_config.map((turno) =>
        turno.id === id ? { ...turno, [campo]: valor } : turno
      ),
    }));
  };

  const eliminarTurno = (id: string) => {
    setNuevoAmenity((prev) => ({
      ...prev,
      turnos_config: prev.turnos_config.filter((turno) => turno.id !== id),
    }));
  };

  const guardarAmenity = async () => {
    if (!profile?.barrio_id) return;
    if (!nuevoAmenity.nombre.trim()) {
      alert('Ingresá un nombre para el amenity');
      return;
    }

    const precio = parseFloat(nuevoAmenity.precio_reserva || '0');
    const payload = {
      spaceId: profile.barrio_id,
      nombre: nuevoAmenity.nombre.trim(),
      descripcion: nuevoAmenity.descripcion?.trim() || null,
      capacidad: nuevoAmenity.capacidad ? Number(nuevoAmenity.capacidad) : null,
      horaApertura: nuevoAmenity.hora_apertura,
      horaCierre: nuevoAmenity.hora_cierre,
      requiereAprobacion: nuevoAmenity.requiere_aprobacion,
      precioReserva: Number.isNaN(precio) ? 0 : precio,
      turnosConfig: nuevoAmenity.turnos_config.map((turno) => ({
        id: turno.id,
        etiqueta: turno.etiqueta || '',
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
      })),
    };

    try {
      if (editandoAmenity) {
        const { spaceId, ...rest } = payload;
        await api.amenities.actualizar(editandoAmenity.id, rest);
      } else {
        await api.amenities.crear(payload);
      }
      cerrarModalAmenity();
      cargarAmenities();
    } catch (error) {
      console.error('Error al guardar amenity', error);
      alert('No pudimos guardar el amenity');
    }
  };
  const toggleAmenity = async (id: string, activo: boolean) => {
    try {
      await api.amenities.toggle(id, !activo);
      cargarAmenities();
    } catch (error) {
      console.error('Error al cambiar estado del amenity', error);
      alert('No pudimos actualizar el amenity');
    }
  };
  const actualizarReserva = async (id: string, estado: 'confirmada' | 'rechazada') => {
    try {
      await api.reservas.actualizar(id, { estado });
      cargarReservas();
    } catch (error) {
      console.error('Error al actualizar reserva', error);
      alert('No pudimos actualizar la reserva');
    }
  };

  // === ENCUESTAS ===
  const cargarEncuestas = async () => { /* TODO: implementar endpoint */ };
  const cargarResultadosEncuestas = async () => { setResultadosEncuestasLoading(false); };
  const crearEncuesta = async () => { alert('Encuestas: próximamente'); };
  const toggleEncuesta = async (_id: string, _activa: boolean) => { /* TODO */ };

  // === RECLAMOS / TERMINALES ===
  const cargarTerminales = async () => { /* TODO: implementar endpoint */ };
  const crearTerminal = async () => { alert('Terminales: próximamente'); };
  const eliminarTerminal = async (_id: string) => { /* TODO */ };
  const guardarPunto = async () => { alert('Puntos de acceso: próximamente'); };
  const eliminarPunto = async (_id: string) => { /* TODO */ };
  const cargarReclamos = async () => { setReclamosLoading(false); };
  const responderReclamo = async () => { /* TODO */ };
  const cambiarEstadoReclamo = async (_id: string, _estado: string) => { /* TODO */ };

  const eliminarUsuario = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.users.delete(userId);
      cargarUsuarios();
    } catch { console.error('Error al eliminar usuario'); }
  };

  const actualizarRolUsuario = async (userId: string, nuevoRol: string) => {
    try {
      await api.users.update(userId, { rol: nuevoRol });
      cargarUsuarios();
    } catch { console.error('Error al actualizar rol'); }
  };

  const ingresosFiltrados = useMemo(() => {
    const casa = filtroCasa.trim().toLowerCase();
    return ingresos.filter((ing) => {
      const fechaIngreso = new Date(ing.created_at).toISOString().split('T')[0];
      const hora = new Date(ing.created_at).toTimeString().slice(0, 5);
      const coincideHora = hora >= filtroHoraInicio && hora <= filtroHoraFin;
      const coincideCasa = casa ? (ing.casa_destino || '').toLowerCase().includes(casa) : true;
      const coincideFechaInicio = filtroFechaInicio ? fechaIngreso >= filtroFechaInicio : true;
      const coincideFechaFin = filtroFechaFin ? fechaIngreso <= filtroFechaFin : true;
      return coincideHora && coincideCasa && coincideFechaInicio && coincideFechaFin;
    });
  }, [ingresos, filtroCasa, filtroHoraFin, filtroHoraInicio, filtroFechaFin, filtroFechaInicio]);

  const usuariosFiltrados = useMemo(() => {
    const usuario = filtroUsuario.trim().toLowerCase();
    return usuarios.filter((usr) => {
      const coincideUsuario = usuario
        ? (usr.nombre || '').toLowerCase().includes(usuario) ||
          (usr.email || '').toLowerCase().includes(usuario) ||
          (usr.numero_casa || '').toLowerCase().includes(usuario)
        : true;
      const coincideRol = filtroRol === 'todos' || usr.rol === filtroRol;
      return coincideUsuario && coincideRol;
    });
  }, [usuarios, filtroUsuario, filtroRol]);

  const reclamosFiltrados = useMemo(() => {
    const ahora = new Date();
    return reclamos.filter((reclamo) => {
      const fecha = new Date(reclamo.created_at);
      let coincidePeriodo = true;
      if (filtroReclamo === 'hoy') {
        coincidePeriodo = fecha.toDateString() === ahora.toDateString();
      } else if (filtroReclamo === 'ayer') {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        coincidePeriodo = fecha.toDateString() === ayer.toDateString();
      } else if (filtroReclamo === 'esta_semana') {
        const inicioSemana = new Date(ahora);
        const diaSemana = inicioSemana.getDay();
        inicioSemana.setDate(ahora.getDate() - diaSemana);
        inicioSemana.setHours(0, 0, 0, 0);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 7);
        coincidePeriodo = fecha >= inicioSemana && fecha < finSemana;
      } else if (filtroReclamo === 'este_mes') {
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
        coincidePeriodo = fecha >= inicioMes && fecha < finMes;
      }

      const coincideEstado = filtroReclamoEstado === 'todos' || reclamo.estado === filtroReclamoEstado;
      return coincidePeriodo && coincideEstado;
    });
  }, [reclamos, filtroReclamo, filtroReclamoEstado]);

  const layoutStyle = useMemo(() => (
    activeTab === 'general' || activeTab === 'expensas' ? styles.content : styles.singleColumnMain
  ), [activeTab]);

  const renderGeneralTab = () => (
    <>
      <section style={styles.leftColumn}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>⚙️ Configuración</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: 14 }}>Registrar salidas</p>
              <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>El guardia puede registrar la salida al escanear un QR ya ingresado</p>
            </div>
            <div
              onClick={() => toggleRegistrarSalidas(!(barrioInfo?.registrar_salidas ?? false))}
              style={{ width: 44, height: 24, borderRadius: 24, cursor: 'pointer', flexShrink: 0, position: 'relative', transition: '0.2s', backgroundColor: barrioInfo?.registrar_salidas ? '#3b82f6' : '#334155' }}
            >
              <div style={{ position: 'absolute', height: 18, width: 18, left: barrioInfo?.registrar_salidas ? 23 : 3, bottom: 3, backgroundColor: 'white', borderRadius: '50%', transition: '0.2s' }} />
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>⏳ Solicitudes Pendientes</h3>
            <span style={styles.cardSub}>{lbl.Miembros} esperando aprobación</span>
          </div>

          <div style={styles.usersList}>
            {solicitudesLoading ? (
              <p style={styles.emptyResults}>Cargando solicitudes...</p>
            ) : solicitudesError ? (
              <p style={styles.errorMsg}>{solicitudesError}</p>
            ) : solicitudesPendientes.length === 0 ? (
              <p style={styles.emptyResults}>No hay solicitudes pendientes</p>
            ) : (
              solicitudesPendientes.map((solicitud) => (
                <div key={solicitud.id} style={styles.solicitudRow}>
                  <div>
                    <p style={styles.userNombre}>{solicitud.nombre || 'Sin nombre'}</p>
                    <p style={styles.userEmail}>{solicitud.email}</p>
                    <p style={styles.userMeta}>
                      {lbl.Unidad}: {solicitud.numero_casa || 'N/A'} • 
                      Teléfono: {solicitud.telefono || 'N/A'} • 
                      Solicitado: {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div style={styles.solicitudActions}>
                    <button
                      style={styles.approveButton}
                      onClick={() => aprobarUsuario(solicitud.id)}
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      style={styles.rejectButton}
                      onClick={() => rechazarUsuario(solicitud.id)}
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>👥 Usuarios del {lbl.tipoEspacio}</h3>
            <span style={styles.cardSub}>Gestioná {lbl.miembros} y roles</span>
          </div>

          <div style={styles.filtersRow}>
            <label style={styles.filterLabel}>
              Buscar
              <input
                style={styles.filterInput}
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                placeholder={`Nombre, email o ${lbl.unidad.toLowerCase()}`}
              />
            </label>
            <label style={styles.filterLabel}>
              Rol
              <select
                style={styles.filterInput}
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value as any)}
              >
                <option value="todos">Todos</option>
                <option value="vecino">{lbl.Miembros}</option>
                <option value="guardia">Guardias</option>
                <option value="admin">Admins</option>
              </select>
            </label>
            <button
              style={styles.createButton}
              onClick={() => setShowCreateUser(true)}
            >
              + Nuevo Usuario
            </button>
          </div>

          <div style={styles.usersList}>
            {usuariosLoading ? (
              <p style={styles.emptyResults}>Cargando usuarios...</p>
            ) : usuariosError ? (
              <p style={styles.errorMsg}>{usuariosError}</p>
            ) : usuariosFiltrados.length === 0 ? (
              <p style={styles.emptyResults}>No hay usuarios para esos filtros</p>
            ) : (
              usuariosFiltrados.map((usr) => (
                <div key={usr.id} style={styles.userRow}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ ...styles.userNombre, margin: 0 }}>{usr.nombre || 'Sin nombre'}</p>
                      {usr.rol === 'vecino' && (
                        usr.es_titular
                          ? <span style={{ fontSize: 11, fontWeight: 700, background: '#14532d', color: '#4ade80', borderRadius: 6, padding: '2px 8px' }}>Titular</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, background: '#1e293b', color: '#94a3b8', borderRadius: 6, padding: '2px 8px' }}>Sub-usuario</span>
                      )}
                    </div>
                    <p style={styles.userEmail}>{usr.email}</p>
                    <p style={styles.userMeta}>
                      {usr.rol.toUpperCase()} • {lbl.Unidad}: {usr.numero_casa || 'N/A'} • 
                      Último acceso: {usr.last_sign_in_at ?
                        new Date(usr.last_sign_in_at).toLocaleDateString('es-AR') : 'Nunca'}
                    </p>
                  </div>
                  <div style={styles.userActions}>
                    <select
                      style={styles.roleSelect}
                      value={usr.rol}
                      onChange={(e) => actualizarRolUsuario(usr.id, e.target.value)}
                    >
                      <option value="vecino">{lbl.Miembro}</option>
                      <option value="guardia">Guardia</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      style={styles.deleteButton}
                      onClick={() => eliminarUsuario(usr.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section style={styles.rightColumn}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>📋 Accesos del {lbl.tipoEspacio}</h3>
            <span style={styles.cardSub}>Aplicá filtros por {lbl.unidad.toLowerCase()}, fecha y horario</span>
          </div>
          <div style={styles.filtersRow}>
            <label style={styles.filterLabel}>
              {lbl.Unidad}
              <input
                style={styles.filterInput}
                value={filtroCasa}
                onChange={(e) => setFiltroCasa(e.target.value)}
                placeholder="Ej: 12"
              />
            </label>
            <label style={styles.filterLabel}>
              Fecha Inicio
              <input
                style={styles.filterInput}
                type="date"
                value={filtroFechaInicio}
                onChange={(e) => setFiltroFechaInicio(e.target.value)}
              />
            </label>
            <label style={styles.filterLabel}>
              Fecha Fin
              <input
                style={styles.filterInput}
                type="date"
                value={filtroFechaFin}
                onChange={(e) => setFiltroFechaFin(e.target.value)}
              />
            </label>
            <label style={styles.filterLabel}>
              Desde
              <input
                style={styles.filterInput}
                type="time"
                value={filtroHoraInicio}
                onChange={(e) => setFiltroHoraInicio(e.target.value)}
              />
            </label>
            <label style={styles.filterLabel}>
              Hasta
              <input
                style={styles.filterInput}
                type="time"
                value={filtroHoraFin}
                onChange={(e) => setFiltroHoraFin(e.target.value)}
              />
            </label>
            <button style={styles.refreshButton} onClick={cargarIngresos} disabled={ingresosLoading}>
              Recargar
            </button>
          </div>
        </div>

        <div style={styles.tableCard}>
          {ingresosLoading ? (
            <p style={styles.emptyResults}>Cargando ingresos...</p>
          ) : ingresosError ? (
            <p style={styles.errorMsg}>{ingresosError}</p>
          ) : ingresosFiltrados.length === 0 ? (
            <p style={styles.emptyResults}>No hay registros para esos filtros</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Hora</th>
                  <th style={styles.th}>Visitante</th>
                  <th style={styles.th}>DNI</th>
                  <th style={styles.th}>{lbl.Unidad}</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ingresosFiltrados.map((ing) => (
                  <tr key={ing.id}>
                    <td style={styles.td}>{formatFecha(ing.created_at)}</td>
                    <td style={styles.td}>{formatHora(ing.created_at)}</td>
                    <td style={styles.td}>{ing.nombre_visitante || '-'}</td>
                    <td style={styles.td}>{ing.dni_visitante || '-'}</td>
                    <td style={styles.td}>{ing.casa_destino || '-'}</td>
                    <td style={styles.td}>{(ing.tipo || '').toUpperCase()}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusPill, backgroundColor: estadoColor(ing.estado) }}>
                        {ing.estado || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );

  const renderExpensasTab = () => (
    <>
      <section style={styles.leftColumn}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>⚙️ Configuración de Cobros</h3>
            <span style={styles.cardSub}>Configurá tus datos para recibir pagos de los vecinos</span>
          </div>

          <div style={styles.configSection}>
            <div style={styles.configSectionHeader}>
              <h4 style={styles.configSectionTitle}>🟠 Mercado Pago</h4>
              {configPagos?.mp_habilitado && configForm.mp_access_token ? (
                <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✅ Conectado</span>
              ) : (
                <span style={{ fontSize: 13, color: '#64748b' }}>No conectado</span>
              )}
            </div>
            {configPagos?.mp_habilitado && configForm.mp_access_token ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
                  Tu cuenta de Mercado Pago está vinculada. Los vecinos pueden pagar expensas y el dinero llega directo a tu cuenta.
                </p>
                <button
                  style={styles.mpDisconnectBtn}
                  onClick={() => {
                    if (confirm('¿Desconectar Mercado Pago? Los vecinos no podrán pagar por este medio.')) {
                      setConfigForm({ ...configForm, mp_access_token: '', mp_habilitado: false });
                    }
                  }}
                >
                  Desconectar Mercado Pago
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                  Conectá tu cuenta de Mercado Pago para recibir pagos de expensas directamente. El dinero llega a tu cuenta.
                </p>
                <button
                  style={styles.mpConnectBtn}
                  onClick={() => {
                    if (!profile?.barrio_id || !profile?.id) return;
                    const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/pagos/mp-auth?spaceId=${profile.barrio_id}&userId=${profile.id}`;
                    window.open(url, '_blank', 'width=600,height=700');
                  }}
                >
                  Conectar con Mercado Pago
                </button>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Se abrirá Mercado Pago para que inicies sesión y autorices la conexión
                </span>
              </div>
            )}
          </div>

          <div style={{ ...styles.configSection, marginTop: 16 }}>
            <div style={styles.configSectionHeader}>
              <h4 style={styles.configSectionTitle}>🏦 Transferencia Bancaria</h4>
              <label style={styles.switchLabel}>
                <input
                  type="checkbox"
                  checked={configForm.transferencia_habilitada}
                  onChange={(e) => setConfigForm({ ...configForm, transferencia_habilitada: e.target.checked })}
                />
                {configForm.transferencia_habilitada ? 'Habilitado' : 'Deshabilitado'}
              </label>
            </div>
            {configForm.transferencia_habilitada && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={styles.modalLabel}>
                  Banco
                  <input
                    style={styles.modalInput}
                    value={configForm.banco_nombre}
                    onChange={(e) => setConfigForm({ ...configForm, banco_nombre: e.target.value })}
                    placeholder="Ej: Banco Galicia"
                  />
                </label>
                <label style={styles.modalLabel}>
                  Titular de la cuenta
                  <input
                    style={styles.modalInput}
                    value={configForm.banco_titular}
                    onChange={(e) => setConfigForm({ ...configForm, banco_titular: e.target.value })}
                    placeholder="Nombre del titular"
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={styles.modalLabel}>
                    CBU
                    <input
                      style={styles.modalInput}
                      value={configForm.banco_cbu}
                      onChange={(e) => setConfigForm({ ...configForm, banco_cbu: e.target.value })}
                      placeholder="0000000000000000000000"
                    />
                  </label>
                  <label style={styles.modalLabel}>
                    Alias
                    <input
                      style={styles.modalInput}
                      value={configForm.banco_alias}
                      onChange={(e) => setConfigForm({ ...configForm, banco_alias: e.target.value })}
                      placeholder="mi.alias.mp"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            style={{ ...styles.createButton, marginTop: 20, width: '100%' }}
            onClick={guardarConfigPagos}
            disabled={configLoading}
          >
            {configLoading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>📋 Expensas</h3>
            <span style={styles.cardSub}>Creá y gestioná las expensas mensuales</span>
          </div>
          <button style={styles.createButton} onClick={() => setShowCrearExpensa(true)}>
            + Nueva Expensa
          </button>
          <div style={styles.usersList}>
            {expensasLoading ? (
              <p style={styles.emptyResults}>Cargando expensas...</p>
            ) : expensas.length === 0 ? (
              <p style={styles.emptyResults}>No hay expensas creadas aún</p>
            ) : (
              expensas.map((exp) => (
                <div key={exp.id} style={styles.userRow}>
                  <div>
                    <p style={styles.userNombre}>{exp.descripcion} — {exp.periodo}</p>
                    <p style={styles.userEmail}>
                      ${exp.monto.toLocaleString('es-AR')}
                      {exp.fecha_vencimiento && ` • Vence: ${new Date(exp.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}`}
                    </p>
                    <p style={styles.userMeta}>
                      {exp.activo ? '✅ Activa' : '⛔ Inactiva'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...styles.approveButton, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => {
                        setEditandoExpensa(exp);
                        setNuevaExpensa({
                          periodo: exp.periodo,
                          descripcion: exp.descripcion,
                          monto: String(exp.monto),
                          fecha_vencimiento: exp.fecha_vencimiento || '',
                        });
                        setShowCrearExpensa(true);
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      style={{ ...styles.rejectButton, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => eliminarExpensa(exp.id)}
                    >
                      🗑️
                    </button>
                    <button
                      style={exp.activo ? styles.rejectButton : styles.approveButton}
                      onClick={() => toggleExpensaActiva(exp.id, exp.activo)}
                    >
                      {exp.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section style={styles.rightColumn}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>💳 Pagos Recibidos</h3>
            <span style={styles.cardSub}>Controlá los pagos de expensas</span>
          </div>
          <div style={styles.filtersRow}>
            <label style={styles.filterLabel}>
              Período
              <select
                style={styles.filterInput}
                value={filtroExpensa}
                onChange={(e) => setFiltroExpensa(e.target.value)}
              >
                <option value="todas">Todas</option>
                {expensas.map((exp) => (
                  <option key={exp.id} value={exp.id}>{exp.periodo} — {exp.descripcion}</option>
                ))}
              </select>
            </label>
            <label style={styles.filterLabel}>
              Estado
              <select
                style={styles.filterInput}
                value={filtroPagoEstado}
                onChange={(e) => setFiltroPagoEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </label>
            <button style={styles.refreshButton} onClick={cargarPagos} disabled={pagosLoading}>
              Recargar
            </button>
          </div>
        </div>

        <div style={styles.tableCard}>
          {pagosLoading ? (
            <p style={styles.emptyResults}>Cargando pagos...</p>
          ) : pagosFiltrados.length === 0 ? (
            <p style={styles.emptyResults}>No hay pagos registrados</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Vecino</th>
                  <th style={styles.th}>Casa</th>
                  <th style={styles.th}>Período</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Método</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map((pago) => (
                  <tr key={pago.id}>
                    <td style={styles.td}>{formatFecha(pago.created_at)}</td>
                    <td style={styles.td}>{pago.vecino_nombre}</td>
                    <td style={styles.td}>{pago.vecino_casa}</td>
                    <td style={styles.td}>{pago.periodo}</td>
                    <td style={styles.td}>${pago.monto.toLocaleString('es-AR')}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusPill,
                        backgroundColor: pago.metodo_pago === 'mercadopago' ? '#3b82f6' : '#8b5cf6'
                      }}>
                        {pago.metodo_pago === 'mercadopago' ? 'MP' : 'Transf'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusPill, backgroundColor: estadoColor(pago.estado) }}>
                        {pago.estado}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {pago.estado === 'pendiente' && pago.metodo_pago === 'transferencia' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={styles.approveButton} onClick={() => actualizarEstadoPago(pago.id, 'aprobado')}>✅</button>
                          <button style={styles.rejectButton} onClick={() => actualizarEstadoPago(pago.id, 'rechazado')}>❌</button>
                        </div>
                      )}
                      {pago.estado === 'pendiente' && pago.metodo_pago === 'mercadopago' && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>Se confirma automáticamente</span>
                      )}
                      {pago.comprobante_url && (
                        <a href={pago.comprobante_url} target="_blank" rel="noopener" style={{ color: '#38bdf8', fontSize: 12 }}>
                          Ver comprobante
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <main style={layoutStyle}>
            <section style={styles.leftColumn}>
              {/* Stats dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { label: lbl.Miembros, value: stats.totalVecinos, icon: lbl.icon, color: '#3b82f6' },
                  { label: 'Guardias', value: stats.totalGuardias, icon: '🛡️', color: '#8b5cf6' },
                  { label: 'Pendientes', value: stats.pendientes, icon: '⏳', color: stats.pendientes > 0 ? '#f59e0b' : '#22c55e' },
                  { label: 'Ingresos hoy', value: stats.ingresosHoy, icon: '🚗', color: '#06b6d4' },
                ].map((s) => (
                  <div key={s.label} style={{ background: '#0b1534', borderRadius: 12, padding: '16px 20px', border: `1px solid ${s.color}33` }}>
                    <p style={{ fontSize: 22, margin: '0 0 4px', fontWeight: 800, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: 12, margin: 0, color: '#94a3b8' }}>{s.icon} {s.label}</p>
                  </div>
                ))}
              </div>

              {/* Configuración */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>⚙️ Configuración</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div>
                    <p style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: 14 }}>Registrar salidas</p>
                    <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>El guardia puede registrar la salida al escanear un QR ya ingresado</p>
                  </div>
                  <div
                    onClick={() => toggleRegistrarSalidas(!(barrioInfo?.registrar_salidas ?? false))}
                    style={{ width: 44, height: 24, borderRadius: 24, cursor: 'pointer', flexShrink: 0, marginLeft: 16, position: 'relative', transition: '0.2s', backgroundColor: barrioInfo?.registrar_salidas ? '#3b82f6' : '#334155' }}
                  >
                    <div style={{ position: 'absolute', height: 18, width: 18, left: barrioInfo?.registrar_salidas ? 23 : 3, bottom: 3, backgroundColor: 'white', borderRadius: '50%', transition: '0.2s' }} />
                  </div>
                </div>
              </div>

              {/* Sección de Solicitudes Pendientes */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>⏳ Solicitudes Pendientes</h3>
                  <span style={styles.cardSub}>{lbl.Miembros} esperando aprobación</span>
                </div>

                <div style={styles.usersList}>
                  {solicitudesLoading ? (
                    <p style={styles.emptyResults}>Cargando solicitudes...</p>
                  ) : solicitudesError ? (
                    <p style={styles.errorMsg}>{solicitudesError}</p>
                  ) : solicitudesPendientes.length === 0 ? (
                    <p style={styles.emptyResults}>No hay solicitudes pendientes</p>
                  ) : (
                    solicitudesPendientes.map((solicitud) => (
                      <div key={solicitud.id} style={styles.solicitudRow}>
                        <div>
                          <p style={styles.userNombre}>{solicitud.nombre || 'Sin nombre'}</p>
                          <p style={styles.userEmail}>{solicitud.email}</p>
                          <p style={styles.userMeta}>
                            {lbl.Unidad}: {solicitud.numero_casa || 'N/A'} • 
                            Teléfono: {solicitud.telefono || 'N/A'} • 
                            Solicitado: {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div style={styles.solicitudActions}>
                          <button 
                            style={styles.approveButton} 
                            onClick={() => aprobarUsuario(solicitud.id)}
                          >
                            ✅ Aprobar
                          </button>
                          <button 
                            style={styles.rejectButton} 
                            onClick={() => rechazarUsuario(solicitud.id)}
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>👥 Usuarios del {lbl.tipoEspacio}</h3>
                  <span style={styles.cardSub}>Gestioná {lbl.miembros} y roles</span>
                </div>
                
                <div style={styles.filtersRow}>
                  <label style={styles.filterLabel}>
                    Buscar
                    <input
                      style={styles.filterInput}
                      value={filtroUsuario}
                      onChange={(e) => setFiltroUsuario(e.target.value)}
                      placeholder={`Nombre, email o ${lbl.unidad.toLowerCase()}`}
                    />
                  </label>
                  <label style={styles.filterLabel}>
                    Rol
                    <select
                      style={styles.filterInput}
                      value={filtroRol}
                      onChange={(e) => setFiltroRol(e.target.value as any)}
                    >
                      <option value="todos">Todos</option>
                      <option value="vecino">{lbl.Miembros}</option>
                      <option value="guardia">Guardias</option>
                      <option value="admin">Admins</option>
                    </select>
                  </label>
                  <button 
                    style={styles.createButton} 
                    onClick={() => setShowCreateUser(true)}
                  >
                    + Nuevo Usuario
                  </button>
                </div>

                <div style={styles.usersList}>
                  {usuariosLoading ? (
                    <p style={styles.emptyResults}>Cargando usuarios...</p>
                  ) : usuariosError ? (
                    <p style={styles.errorMsg}>{usuariosError}</p>
                  ) : usuariosFiltrados.length === 0 ? (
                    <p style={styles.emptyResults}>No hay usuarios para esos filtros</p>
                  ) : (
                    usuariosFiltrados.map((usr) => (
                      <div key={usr.id} style={styles.userRow}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ ...styles.userNombre, margin: 0 }}>{usr.nombre || 'Sin nombre'}</p>
                            {usr.rol === 'vecino' && (
                              usr.es_titular
                                ? <span style={{ fontSize: 11, fontWeight: 700, background: '#14532d', color: '#4ade80', borderRadius: 6, padding: '2px 8px' }}>Titular</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, background: '#1e293b', color: '#94a3b8', borderRadius: 6, padding: '2px 8px' }}>Sub-usuario</span>
                            )}
                          </div>
                          <p style={styles.userEmail}>{usr.email}</p>
                          <p style={styles.userMeta}>
                            {usr.rol.toUpperCase()} • {lbl.Unidad}: {usr.numero_casa || 'N/A'} • 
                            Último acceso: {usr.last_sign_in_at ? 
                              new Date(usr.last_sign_in_at).toLocaleDateString('es-AR') : 'Nunca'}
                          </p>
                        </div>
                        <div style={styles.userActions}>
                          <select
                            style={styles.roleSelect}
                            value={usr.rol}
                            onChange={(e) => actualizarRolUsuario(usr.id, e.target.value)}
                          >
                            <option value="vecino">{lbl.Miembro}</option>
                            <option value="guardia">Guardia</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button 
                            style={styles.deleteButton} 
                            onClick={() => eliminarUsuario(usr.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section style={styles.rightColumn}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>📋 Accesos del {lbl.tipoEspacio}</h3>
                  <span style={styles.cardSub}>Aplicá filtros por {lbl.unidad.toLowerCase()}, fecha y horario</span>
                </div>
                <div style={styles.filtersRow}>
                  <label style={styles.filterLabel}>
                    {lbl.Unidad}
                    <input
                      style={styles.filterInput}
                      value={filtroCasa}
                      onChange={(e) => setFiltroCasa(e.target.value)}
                      placeholder="Ej: 12"
                    />
                  </label>
                  <label style={styles.filterLabel}>
                    Fecha Inicio
                    <input
                      style={styles.filterInput}
                      type="date"
                      value={filtroFechaInicio}
                      onChange={(e) => setFiltroFechaInicio(e.target.value)}
                    />
                  </label>
                  <label style={styles.filterLabel}>
                    Fecha Fin
                    <input
                      style={styles.filterInput}
                      type="date"
                      value={filtroFechaFin}
                      onChange={(e) => setFiltroFechaFin(e.target.value)}
                    />
                  </label>
                  <label style={styles.filterLabel}>
                    Desde
                    <input
                      style={styles.filterInput}
                      type="time"
                      value={filtroHoraInicio}
                      onChange={(e) => setFiltroHoraInicio(e.target.value)}
                    />
                  </label>
                  <label style={styles.filterLabel}>
                    Hasta
                    <input
                      style={styles.filterInput}
                      type="time"
                      value={filtroHoraFin}
                      onChange={(e) => setFiltroHoraFin(e.target.value)}
                    />
                  </label>
                  <button style={styles.refreshButton} onClick={cargarIngresos} disabled={ingresosLoading}>
                    Recargar
                  </button>
                </div>
              </div>

              <div style={styles.tableCard}>
                {ingresosLoading ? (
                  <p style={styles.emptyResults}>Cargando ingresos...</p>
                ) : ingresosError ? (
                  <p style={styles.errorMsg}>{ingresosError}</p>
                ) : ingresosFiltrados.length === 0 ? (
                  <p style={styles.emptyResults}>No hay registros para esos filtros</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Fecha</th>
                        <th style={styles.th}>Hora</th>
                        <th style={styles.th}>Visitante</th>
                        <th style={styles.th}>DNI</th>
                        <th style={styles.th}>Casa</th>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingresosFiltrados.map((ing) => (
                        <tr key={ing.id}>
                          <td style={styles.td}>{formatFecha(ing.created_at)}</td>
                          <td style={styles.td}>{formatHora(ing.created_at)}</td>
                          <td style={styles.td}>{ing.nombre_visitante || '-'}</td>
                          <td style={styles.td}>{ing.dni_visitante || '-'}</td>
                          <td style={styles.td}>{ing.casa_destino || '-'}</td>
                          <td style={styles.td}>{(ing.tipo || '').toUpperCase()}</td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusPill, backgroundColor: estadoColor(ing.estado) }}>
                              {ing.estado || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </main>
        );

      case 'expensas':
        return (
          <main style={layoutStyle}>
            <section style={styles.leftColumn}>
              {/* Configuración de pagos */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>⚙️ Configuración de Cobros</h3>
                  <span style={styles.cardSub}>Configurá tus datos para recibir pagos de los {lbl.miembros}</span>
                </div>

                {/* Mercado Pago */}
                <div style={styles.configSection}>
                  <div style={styles.configSectionHeader}>
                    <h4 style={styles.configSectionTitle}>🟠 Mercado Pago</h4>
                    {configPagos?.mp_habilitado && configForm.mp_access_token ? (
                      <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✅ Conectado</span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#64748b' }}>No conectado</span>
                    )}
                  </div>
                  {configPagos?.mp_habilitado && configForm.mp_access_token ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
                        Tu cuenta de Mercado Pago está vinculada. Los {lbl.miembros} pueden pagar {lbl.subCobros} y el dinero llega directo a tu cuenta.
                      </p>
                      <button
                        style={styles.mpDisconnectBtn}
                        onClick={() => {
                          if (confirm(`¿Desconectar Mercado Pago? Los ${lbl.miembros} no podrán pagar por este medio.`)) {
                            setConfigForm({ ...configForm, mp_access_token: '', mp_habilitado: false });
                          }
                        }}
                      >
                        Desconectar Mercado Pago
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '12px 0' }}>
                      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
                        Conectá tu cuenta de Mercado Pago para recibir pagos de {lbl.subCobros} directamente. El dinero llega a tu cuenta.
                      </p>
                      <button
                        style={styles.mpConnectBtn}
                        onClick={() => {
                          if (!profile?.barrio_id || !profile?.id) return;
                          const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/pagos/mp-auth?spaceId=${profile.barrio_id}&userId=${profile.id}`;
                          window.open(url, '_blank', 'width=600,height=700');
                        }}
                      >
                        Conectar con Mercado Pago
                      </button>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Se abrirá Mercado Pago para que inicies sesión y autorices la conexión
                      </span>
                    </div>
                  )}
                </div>

                {/* Transferencia bancaria */}
                <div style={{ ...styles.configSection, marginTop: 16 }}>
                  <div style={styles.configSectionHeader}>
                    <h4 style={styles.configSectionTitle}>🏦 Transferencia Bancaria</h4>
                    <label style={styles.switchLabel}>
                      <input
                        type="checkbox"
                        checked={configForm.transferencia_habilitada}
                        onChange={(e) => setConfigForm({ ...configForm, transferencia_habilitada: e.target.checked })}
                      />
                      {configForm.transferencia_habilitada ? 'Habilitado' : 'Deshabilitado'}
                    </label>
                  </div>
                  {configForm.transferencia_habilitada && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label style={styles.modalLabel}>
                        Banco
                        <input
                          style={styles.modalInput}
                          value={configForm.banco_nombre}
                          onChange={(e) => setConfigForm({ ...configForm, banco_nombre: e.target.value })}
                          placeholder="Ej: Banco Galicia"
                        />
                      </label>
                      <label style={styles.modalLabel}>
                        Titular de la cuenta
                        <input
                          style={styles.modalInput}
                          value={configForm.banco_titular}
                          onChange={(e) => setConfigForm({ ...configForm, banco_titular: e.target.value })}
                          placeholder="Nombre del titular"
                        />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={styles.modalLabel}>
                          CBU
                          <input
                            style={styles.modalInput}
                            value={configForm.banco_cbu}
                            onChange={(e) => setConfigForm({ ...configForm, banco_cbu: e.target.value })}
                            placeholder="0000000000000000000000"
                          />
                        </label>
                        <label style={styles.modalLabel}>
                          Alias
                          <input
                            style={styles.modalInput}
                            value={configForm.banco_alias}
                            onChange={(e) => setConfigForm({ ...configForm, banco_alias: e.target.value })}
                            placeholder="mi.alias.mp"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  style={{ ...styles.createButton, marginTop: 20, width: '100%' }}
                  onClick={guardarConfigPagos}
                  disabled={configLoading}
                >
                  {configLoading ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>

              {/* Lista de Expensas */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>📋 Expensas</h3>
                  <span style={styles.cardSub}>Creá y gestioná las expensas mensuales</span>
                </div>
                <button style={styles.createButton} onClick={() => setShowCrearExpensa(true)}>
                  + Nueva Expensa
                </button>
                <div style={styles.usersList}>
                  {expensasLoading ? (
                    <p style={styles.emptyResults}>Cargando expensas...</p>
                  ) : expensas.length === 0 ? (
                    <p style={styles.emptyResults}>No hay expensas creadas aún</p>
                  ) : (
                    expensas.map((exp) => (
                      <div key={exp.id} style={styles.userRow}>
                        <div>
                          <p style={styles.userNombre}>{exp.descripcion} — {exp.periodo}</p>
                          <p style={styles.userEmail}>
                            ${exp.monto.toLocaleString('es-AR')}
                            {exp.fecha_vencimiento && ` • Vence: ${new Date(exp.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}`}
                          </p>
                          <p style={styles.userMeta}>
                            {exp.activo ? '✅ Activa' : '⛔ Inactiva'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={{ ...styles.approveButton, padding: '6px 10px', fontSize: 12 }}
                            onClick={() => {
                              setEditandoExpensa(exp);
                              setNuevaExpensa({
                                periodo: exp.periodo,
                                descripcion: exp.descripcion,
                                monto: String(exp.monto),
                                fecha_vencimiento: exp.fecha_vencimiento || '',
                              });
                              setShowCrearExpensa(true);
                            }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            style={{ ...styles.rejectButton, padding: '6px 10px', fontSize: 12 }}
                            onClick={() => eliminarExpensa(exp.id)}
                          >
                            🗑️
                          </button>
                          <button
                            style={exp.activo ? styles.rejectButton : styles.approveButton}
                            onClick={() => toggleExpensaActiva(exp.id, exp.activo)}
                          >
                            {exp.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Columna derecha: Pagos */}
            <section style={styles.rightColumn}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>💳 Pagos Recibidos</h3>
                  <span style={styles.cardSub}>Controlá los pagos de expensas</span>
                </div>
                <div style={styles.filtersRow}>
                  <label style={styles.filterLabel}>
                    Período
                    <select
                      style={styles.filterInput}
                      value={filtroExpensa}
                      onChange={(e) => setFiltroExpensa(e.target.value)}
                    >
                      <option value="todas">Todas</option>
                      {expensas.map((exp) => (
                        <option key={exp.id} value={exp.id}>{exp.periodo} — {exp.descripcion}</option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.filterLabel}>
                    Estado
                    <select
                      style={styles.filterInput}
                      value={filtroPagoEstado}
                      onChange={(e) => setFiltroPagoEstado(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </label>
                  <button style={styles.refreshButton} onClick={cargarPagos} disabled={pagosLoading}>
                    Recargar
                  </button>
                </div>
              </div>

              <div style={styles.tableCard}>
                {pagosLoading ? (
                  <p style={styles.emptyResults}>Cargando pagos...</p>
                ) : pagosFiltrados.length === 0 ? (
                  <p style={styles.emptyResults}>No hay pagos registrados</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Fecha</th>
                        <th style={styles.th}>Vecino</th>
                        <th style={styles.th}>Casa</th>
                        <th style={styles.th}>Período</th>
                        <th style={styles.th}>Monto</th>
                        <th style={styles.th}>Método</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosFiltrados.map((pago) => (
                        <tr key={pago.id}>
                          <td style={styles.td}>{formatFecha(pago.created_at)}</td>
                          <td style={styles.td}>{pago.vecino_nombre}</td>
                          <td style={styles.td}>{pago.vecino_casa}</td>
                          <td style={styles.td}>{pago.periodo}</td>
                          <td style={styles.td}>${pago.monto.toLocaleString('es-AR')}</td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statusPill,
                              backgroundColor: pago.metodo_pago === 'mercadopago' ? '#3b82f6' : '#8b5cf6'
                            }}>
                              {pago.metodo_pago === 'mercadopago' ? 'MP' : 'Transf'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusPill, backgroundColor: estadoColor(pago.estado) }}>
                              {pago.estado}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {pago.estado === 'pendiente' && pago.metodo_pago === 'transferencia' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button style={styles.approveButton} onClick={() => actualizarEstadoPago(pago.id, 'aprobado')}>✅</button>
                                <button style={styles.rejectButton} onClick={() => actualizarEstadoPago(pago.id, 'rechazado')}>❌</button>
                              </div>
                            )}
                            {pago.estado === 'pendiente' && pago.metodo_pago === 'mercadopago' && (
                              <span style={{ fontSize: 11, color: '#64748b' }}>Se confirma automáticamente</span>
                            )}
                            {pago.comprobante_url && (
                              <a href={pago.comprobante_url} target="_blank" rel="noopener" style={{ color: '#38bdf8', fontSize: 12 }}>
                                Ver comprobante
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </main>
        );
      case 'amenities':
        return (
          <main style={layoutStyle}>
            <div style={styles.card}>
              <div style={{ ...styles.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h3 style={styles.cardTitle}>🏊 Amenities del barrio</h3><span style={styles.cardSub}>Configurá los espacios disponibles</span></div>
                <button style={styles.createButton} onClick={abrirCrearAmenity}>+ Nuevo Amenity</button>
              </div>
              <div style={{ ...styles.usersList, maxHeight: 'none', overflow: 'visible' }}>
                {amenities.length === 0 ? <p style={styles.emptyResults}>No hay amenities. Creá el primero.</p> : amenities.map((a) => (
                  <div key={a.id} style={styles.userRow}>
                    <div>
                      <p style={styles.userNombre}>{a.nombre} {!a.activo && '(desactivado)'}</p>
                      <p style={styles.userEmail}>{a.descripcion || 'Sin descripción'}</p>
                      <p style={styles.userMeta}>🕐 {a.hora_apertura?.slice(0,5)} - {a.hora_cierre?.slice(0,5)}{a.capacidad ? ` • 👥 ${a.capacidad}` : ''}{a.requiere_aprobacion ? ' • ⚠️ Requiere aprobación' : ' • ✅ Auto-confirmado'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...styles.approveButton, padding: '6px 10px', fontSize: 12 }} onClick={() => abrirEditarAmenity(a)}>✏️ Editar</button>
                      <button style={{ ...styles.deleteButton, color: a.activo ? '#ef4444' : '#22c55e', fontSize: 13 }} onClick={() => toggleAmenity(a.id, a.activo)}>{a.activo ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardHeader}><h3 style={styles.cardTitle}>📅 Reservas recientes</h3></div>
              <div style={{ ...styles.usersList, maxHeight: 'none', overflow: 'visible' }}>
                {reservas.length === 0 ? <p style={styles.emptyResults}>No hay reservas</p> : reservas.map((r: any) => (
                  <div key={r.id} style={styles.userRow}>
                    <div>
                      <p style={styles.userNombre}>{r.amenity_nombre} - {r.fecha}</p>
                      <p style={styles.userEmail}>{r.vecino_nombre} (Casa {r.vecino_casa || 'N/A'}) • {r.hora_inicio?.slice(0,5)} - {r.hora_fin?.slice(0,5)}</p>
                    </div>
                    <div style={styles.userActions}>
                      <span style={{ ...styles.statusPill, backgroundColor: r.estado === 'confirmada' ? '#22c55e' : r.estado === 'pendiente' ? '#eab308' : '#6b7280' }}>{r.estado}</span>
                      {r.estado === 'pendiente' && (<><button style={styles.approveButton} onClick={() => actualizarReserva(r.id, 'confirmada')}>✅</button><button style={styles.rejectButton} onClick={() => actualizarReserva(r.id, 'rechazada')}>❌</button></>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        );
      case 'encuestas':
        return (
          <main style={layoutStyle}>
            <div style={styles.card}>
              <div style={{ ...styles.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h3 style={styles.cardTitle}>📊 Encuestas</h3><span style={styles.cardSub}>Creá encuestas para los vecinos</span></div>
                <button style={styles.createButton} onClick={() => setShowCrearEncuesta(true)}>+ Nueva Encuesta</button>
              </div>
              <div style={{ ...styles.usersList, maxHeight: 'none', overflow: 'visible' }}>
                {encuestas.length === 0 ? <p style={styles.emptyResults}>No hay encuestas.</p> : encuestas.map((e: any) => {
                  const resultados = resultadosEncuestas[e.id] || {};
                  const totalVotos = Object.values(resultados).reduce((acc, val) => acc + val, 0);
                  return (
                    <div key={e.id} style={styles.userRow}>
                      <div>
                        <p style={styles.userNombre}>{e.titulo} {!e.activa && '(cerrada)'}</p>
                        {e.descripcion && <p style={styles.userEmail}>{e.descripcion}</p>}
                        <p style={styles.userMeta}>Opciones: {(e.opciones || []).join(' | ')}{e.multiple ? ' • Múltiple' : ''}{e.fecha_cierre ? ` • Cierre: ${new Date(e.fecha_cierre).toLocaleDateString('es-AR')}` : ''}</p>
                        <div style={styles.resultadosBox}>
                          <div style={styles.resultadosHeader}>
                            <span>Resultados</span>
                            {resultadosEncuestasLoading ? <span style={styles.resultadosHint}>Cargando...</span> : <span style={styles.resultadosHint}>{totalVotos} voto{totalVotos === 1 ? '' : 's'}</span>}
                          </div>
                          {(e.opciones || []).map((opcion: string, idx: number) => {
                            const cantidad = resultados[idx] || 0;
                            const porcentaje = totalVotos > 0 ? Math.round((cantidad / totalVotos) * 100) : 0;
                            return (
                              <div key={idx} style={styles.resultadoRow}>
                                <div style={styles.resultadoLabel}>
                                  <span>{opcion}</span>
                                  <span>{cantidad} • {porcentaje}%</span>
                                </div>
                                <div style={styles.resultadoBarWrapper}>
                                  <div style={{ ...styles.resultadoBar, width: `${porcentaje}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {totalVotos === 0 && !resultadosEncuestasLoading && (
                            <p style={styles.resultadosHint}>Aún no hay votos</p>
                          )}
                        </div>
                      </div>
                      <button style={{ ...styles.deleteButton, color: e.activa ? '#ef4444' : '#22c55e', fontSize: 13 }} onClick={() => toggleEncuesta(e.id, e.activa)}>{e.activa ? 'Cerrar' : 'Reabrir'}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        );
      case 'reclamos':
        return (
          <main style={layoutStyle}>
            <div style={styles.card}>
              <div style={styles.cardHeader}><h3 style={styles.cardTitle}>📋 Reclamos de vecinos</h3></div>
              <div style={styles.filtersRow}>
                <label style={styles.filterLabel}>
                  Período
                  <select
                    style={styles.filterInput}
                    value={filtroReclamo}
                    onChange={(e) => setFiltroReclamo(e.target.value as typeof filtroReclamo)}
                  >
                    <option value="todos">Todos</option>
                    <option value="hoy">Hoy</option>
                    <option value="ayer">Ayer</option>
                    <option value="esta_semana">Esta semana</option>
                    <option value="este_mes">Este mes</option>
                  </select>
                </label>
                <label style={styles.filterLabel}>
                  Estado
                  <select
                    style={styles.filterInput}
                    value={filtroReclamoEstado}
                    onChange={(e) => setFiltroReclamoEstado(e.target.value as typeof filtroReclamoEstado)}
                  >
                    <option value="todos">Todos</option>
                    <option value="abierto">Abierto</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </label>
                <button style={styles.refreshButton} onClick={cargarReclamos} disabled={reclamosLoading}>
                  {reclamosLoading ? 'Cargando...' : 'Recargar'}
                </button>
              </div>
              <div style={styles.usersList}>
                {reclamosLoading ? (
                  <p style={styles.emptyResults}>Cargando reclamos...</p>
                ) : reclamosFiltrados.length === 0 ? (
                  <p style={styles.emptyResults}>No hay reclamos</p>
                ) : (
                  reclamosFiltrados.map((r: any) => (
                    <div key={r.id} style={{ ...styles.userRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={styles.userNombre}>{r.titulo}</p>
                          <p style={styles.userEmail}>{r.descripcion}</p>
                          <p style={styles.userMeta}>🏠 {r.vecino_nombre} (Casa {r.vecino_casa || 'N/A'}) • {r.categoria} • {new Date(r.created_at).toLocaleDateString('es-AR')}</p>
                        </div>
                        <select style={styles.roleSelect} value={r.estado} onChange={(ev) => cambiarEstadoReclamo(r.id, ev.target.value)}>
                          <option value="abierto">Abierto</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="resuelto">Resuelto</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      </div>
                      {r.foto_url && <img src={r.foto_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }} />}
                      {r.respuesta_admin && (
                        <div style={{ background: '#0b1534', padding: 12, borderRadius: 10, borderLeft: '3px solid #3b82f6' }}>
                          <p style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, margin: '0 0 4px' }}>💬 Respuesta:</p>
                          <p style={{ fontSize: 14, color: '#e2e8f0', margin: 0 }}>{r.respuesta_admin}</p>
                        </div>
                      )}
                      <button style={{ ...styles.refreshButton, padding: '8px 16px', alignSelf: 'flex-start' }} onClick={() => setReclamoRespuesta({ id: r.id, texto: r.respuesta_admin || '' })}>💬 {r.respuesta_admin ? 'Editar respuesta' : 'Responder'}</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        );
      case 'accesos':
        return (
          <main style={{ padding: '24px 16px', maxWidth: 820, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>🚧 Terminales y Puntos de Acceso</h2>
              <button style={styles.refreshButton} onClick={() => setShowNuevaTerminal(true)}>+ Nueva Terminal</button>
            </div>

            {terminales.length === 0 && (
              <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 32, margin: '0 0 12px' }}>🖥️</p>
                <p style={{ color: '#94a3b8', margin: 0 }}>No hay terminales configuradas.</p>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Cada terminal es una PC, tablet o celular conectado a una o más barreras.</p>
              </div>
            )}

            {terminales.map(terminal => {
              const gates = puntosAcceso.filter(p => p.terminal_id === terminal.id);
              const isOpen = terminalExpandida === terminal.id;
              const panelUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/panel?terminal=${terminal.id}`;
              return (
                <div key={terminal.id} style={{ ...styles.card, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setTerminalExpandida(isOpen ? null : terminal.id)}>
                    <div>
                      <p style={{ color: '#fff', fontWeight: 700, margin: 0, fontSize: 16 }}>🖥️ {terminal.nombre}</p>
                      <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>{gates.length} punto{gates.length !== 1 ? 's' : ''} de acceso</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: 20 }}>{isOpen ? '▲' : '▼'}</span>
                      <button style={{ ...styles.rejectButton, padding: '4px 10px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar terminal y todos sus puntos de acceso?')) eliminarTerminal(terminal.id); }}>
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 16 }}>
                      {/* URL del panel */}
                      <div style={{ background: '#0b1534', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#64748b', fontSize: 12, flex: 1, wordBreak: 'break-all' }}>🔗 {panelUrl}</span>
                        <button style={{ ...styles.refreshButton, padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
                          onClick={() => navigator.clipboard.writeText(panelUrl)}>
                          Copiar URL
                        </button>
                      </div>

                      {/* Gates */}
                      {gates.map(gate => (
                        <div key={gate.id} style={{ background: '#0b1534', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: 14 }}>
                              {gate.tipo === 'IN' ? '🟢' : gate.tipo === 'OUT' ? '🔴' : '🔵'} {gate.nombre}
                            </p>
                            <p style={{ color: '#64748b', fontSize: 12, margin: '3px 0 0' }}>
                              {gate.tipo === 'IN' ? 'Solo Entrada' : gate.tipo === 'OUT' ? 'Solo Salida' : 'Entrada y Salida'}{' '}
                              {gate.barrera?.habilitado ? `· ${gate.barrera.tipo === 'ip_relay' ? `IP: ${gate.barrera.ip}` : 'USB Relay'}` : '· Sin barrera configurada'}
                            </p>
                          </div>
                          <button style={{ ...styles.refreshButton, padding: '4px 10px', fontSize: 12 }}
                            onClick={() => {
                              setEditandoPunto(gate);
                              setShowNuevoPunto(terminal.id);
                              setNuevoPunto({ nombre: gate.nombre, tipo: gate.tipo, barrera: gate.barrera ?? { habilitado: false, tipo: 'ip_relay', ip: '', puerto: 80, endpoint_abrir: '/relay/on', auth_token: '' } });
                            }}>
                            Editar
                          </button>
                          <button style={{ ...styles.rejectButton, padding: '4px 10px', fontSize: 12 }}
                            onClick={() => { if (confirm('¿Eliminar este punto de acceso?')) eliminarPunto(gate.id); }}>
                            Eliminar
                          </button>
                        </div>
                      ))}

                      <button style={{ ...styles.refreshButton, width: '100%', marginTop: 4 }}
                        onClick={() => {
                          setEditandoPunto(null);
                          setNuevoPunto({ nombre: '', tipo: 'BOTH', barrera: { habilitado: false, tipo: 'ip_relay', ip: '', puerto: 80, endpoint_abrir: '/relay/on', auth_token: '' } });
                          setShowNuevoPunto(terminal.id);
                        }}>
                        + Agregar punto de acceso
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </main>
        );
      default:
        return <></>;
    }
  };

  if (!ready) {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.fullContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🔐 Admin QRPass</h1>
          <p style={styles.loginSubtitle}>Ingresá con tu cuenta de administrador</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <input
              style={styles.loginInput}
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              style={styles.loginInput}
              type="password"
              placeholder="Contraseña"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              required
            />
            {loginError && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{loginError}</p>}
            <button style={{ ...styles.loginButton, opacity: loginLoading ? 0.7 : 1 }} type="submit" disabled={loginLoading}>
              {loginLoading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
          <button style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginTop: 12 }} onClick={() => router.push('/')}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (profile?.rol === 'guardia') return null;


  if (profile?.rol !== 'admin' && profile?.rol !== 'super_admin') {
    return (
      <div style={styles.fullContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>⚠️ Acceso Denegado</h1>
          <p style={styles.loginSubtitle}>No tenés permisos de administrador</p>
          <button style={styles.loginButton} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const lbl = getSpaceLabels(barrioInfo?.space_type);

  return (
    <>
      <div style={styles.page}>
        <header style={styles.header}>
          <div>
            <p style={styles.headerLabel}>{lbl.adminLabel}</p>
            <h2 style={styles.headerName}>{profile?.nombre || 'Sin nombre'}</h2>
            {barrioInfo ? (
              <div style={styles.barrioInfoRow}>
                <span style={styles.headerSub}>{lbl.tipoEspacio}: {barrioInfo.nombre}</span>
                <div style={styles.codeRow}>
                  <span style={styles.codeLabel}>Código de acceso:</span>
                  <span style={styles.codePill}>{barrioInfo.codigo_invitacion || 'Sin código'}</span>
                  <button
                    type="button"
                    style={styles.copyButton}
                    onClick={copyCodigo}
                    disabled={!barrioInfo.codigo_invitacion}
                  >
                    Copiar
                  </button>
                  {barrioInfo.codigo_invitacion && (
                    <>
                      <a
                        href={`/join/${barrioInfo.codigo_invitacion}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, textDecoration: 'none', marginLeft: 4 }}
                      >
                        🔗 Ver link
                      </a>
                      <button
                        type="button"
                        style={styles.copyButton}
                        onClick={copyLink}
                      >
                        {copiedLink ? '✓ Copiado' : '📋 Copiar link'}
                      </button>
                    </>
                  )}
                  {copiedCode && <span style={styles.copyHint}>¡Copiado!</span>}
                </div>
              </div>
            ) : (
              <p style={styles.headerSub}>{profile?.barrio_id ? `${lbl.tipoEspacio} asignado ✓` : `⚠️ Sin ${lbl.tipoEspacio.toLowerCase()} asignado`}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {misEspacios.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select
                  style={styles.spaceSwitcher}
                  value={profile?.barrio_id ?? ''}
                  onChange={e => switchSpace(e.target.value)}
                  disabled={switchingSpace}
                >
                  {misEspacios.map(sp => (
                    <option key={sp.space_id} value={sp.space_id}>{sp.space_nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <a href="/nuevo-espacio" style={styles.newSpaceBtn}>+ Nuevo espacio</a>
            <button style={styles.logoutButton} onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </header>

        <div style={styles.tabBar}>
          <button
            style={activeTab === 'general' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('general')}
          >
            🏠 General
          </button>
          <button
            style={activeTab === 'expensas' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('expensas')}
          >
            {lbl.cobrosTab}
          </button>
          <button
            style={activeTab === 'amenities' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('amenities'); cargarAmenities(); cargarReservas(); }}
          >
            🏊 Amenities
          </button>
          <button
            style={activeTab === 'encuestas' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('encuestas'); cargarEncuestas(); cargarResultadosEncuestas(); }}
          >
            📊 Encuestas
          </button>
          <button
            style={activeTab === 'reclamos' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('reclamos'); cargarReclamos(); }}
          >
            📋 Reclamos
          </button>
          <button
            style={activeTab === 'accesos' ? styles.tabActive : styles.tab}
            onClick={() => { setActiveTab('accesos'); cargarTerminales(); }}
          >
            🚧 Accesos
          </button>
        </div>

        {renderTabContent()}
      </div>

      {/* Modal crear expensa */}
      {showCrearExpensa && (
        <div style={styles.modalBackdrop} onClick={() => { setShowCrearExpensa(false); setEditandoExpensa(null); }}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editandoExpensa ? `Editar ${lbl.subCobros.slice(0,1).toUpperCase() + lbl.subCobros.slice(1,-1)}` : `Crear Nueva ${lbl.subCobros.slice(0,1).toUpperCase() + lbl.subCobros.slice(1,-1)}`}</h3>
            <div style={styles.modalForm}>
              <label style={styles.modalLabel}>
                Período (mes)
                <input
                  style={styles.modalInput}
                  type="month"
                  value={nuevaExpensa.periodo}
                  onChange={(e) => setNuevaExpensa({ ...nuevaExpensa, periodo: e.target.value })}
                />
              </label>
              <label style={styles.modalLabel}>
                Descripción
                <input
                  style={styles.modalInput}
                  value={nuevaExpensa.descripcion}
                  onChange={(e) => setNuevaExpensa({ ...nuevaExpensa, descripcion: e.target.value })}
                  placeholder={`Ej: ${lbl.subCobros.charAt(0).toUpperCase() + lbl.subCobros.slice(1)} ordinarias`}
                />
              </label>
              <label style={styles.modalLabel}>
                Monto ($)
                <input
                  style={styles.modalInput}
                  type="number"
                  value={nuevaExpensa.monto}
                  onChange={(e) => setNuevaExpensa({ ...nuevaExpensa, monto: e.target.value })}
                  placeholder="Ej: 15000"
                  min="0"
                  step="0.01"
                />
              </label>
              <label style={styles.modalLabel}>
                Fecha de vencimiento (opcional)
                <input
                  style={styles.modalInput}
                  type="date"
                  value={nuevaExpensa.fecha_vencimiento}
                  onChange={(e) => setNuevaExpensa({ ...nuevaExpensa, fecha_vencimiento: e.target.value })}
                />
              </label>
              <div style={styles.modalButtons}>
                <button style={styles.cancelButton} onClick={() => { setShowCrearExpensa(false); setEditandoExpensa(null); }}>Cancelar</button>
                <button style={styles.createButton} onClick={editandoExpensa ? editarExpensa : crearExpensa}>
                  {editandoExpensa ? 'Guardar Cambios' : 'Crear Expensa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}




      {showCreateUser && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateUser(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Crear Nuevo Usuario</h3>
            <form style={styles.modalForm} onSubmit={crearUsuario}>
              <label style={styles.modalLabel}>
                Email
                <input
                  style={styles.modalInput}
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </label>
              <label style={styles.modalLabel}>
                Nombre Completo
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newUserNombre}
                  onChange={(e) => setNewUserNombre(e.target.value)}
                  required
                />
              </label>
              <label style={styles.modalLabel}>
                Rol
                <select
                  style={styles.modalInput}
                  value={newUserRol}
                  onChange={(e) => setNewUserRol(e.target.value as any)}
                >
                  <option value="vecino">{lbl.Miembro}</option>
                  <option value="guardia">Guardia</option>
                </select>
              </label>
              <label style={styles.modalLabel}>
                {lbl.Unidad} (opcional)
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newUserNumeroCasa}
                  onChange={(e) => setNewUserNumeroCasa(e.target.value)}
                  placeholder="Ej: 12"
                />
              </label>
              <label style={styles.modalLabel}>
                Teléfono (opcional)
                <input
                  style={styles.modalInput}
                  type="tel"
                  value={newUserTelefono}
                  onChange={(e) => setNewUserTelefono(e.target.value)}
                  placeholder="Ej: 11 1234-5678"
                />
              </label>

              {createUserError && <p style={styles.errorMsg}>{createUserError}</p>}

              <div style={styles.modalButtons}>
                <button 
                  style={styles.cancelButton} 
                  type="button" 
                  onClick={() => setShowCreateUser(false)}
                >
                  Cancelar
                </button>
                <button style={styles.createButton} type="submit" disabled={createUserLoading}>
                  {createUserLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCrearAmenity && (
        <div style={styles.modalBackdrop} onClick={cerrarModalAmenity}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editandoAmenity ? 'Editar Amenity' : 'Nuevo Amenity'}</h3>
            <div style={styles.modalScrollableContent}>
              <div style={styles.modalForm}>
              <label style={styles.modalLabel}>Nombre *<input style={styles.modalInput} value={nuevoAmenity.nombre} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, nombre: e.target.value })} placeholder="Ej: SUM, Pileta, Quincho" /></label>
              <label style={styles.modalLabel}>Descripción<input style={styles.modalInput} value={nuevoAmenity.descripcion} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, descripcion: e.target.value })} /></label>
              <label style={styles.modalLabel}>Capacidad<input style={styles.modalInput} type="number" value={nuevoAmenity.capacidad} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, capacidad: e.target.value })} placeholder="Ej: 50" /></label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ ...styles.modalLabel, flex: 1 }}>Apertura<input style={styles.modalInput} type="time" value={nuevoAmenity.hora_apertura} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, hora_apertura: e.target.value })} /></label>
                <label style={{ ...styles.modalLabel, flex: 1 }}>Cierre<input style={styles.modalInput} type="time" value={nuevoAmenity.hora_cierre} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, hora_cierre: e.target.value })} /></label>
              </div>
              <label style={styles.modalLabel}>Precio por reserva ($ ARS, 0 = gratis)<input style={styles.modalInput} type="number" min="0" step="0.01" value={nuevoAmenity.precio_reserva} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, precio_reserva: e.target.value })} placeholder="0" /></label>
              <label style={styles.switchLabel}><input type="checkbox" checked={nuevoAmenity.requiere_aprobacion} onChange={(e) => setNuevoAmenity({ ...nuevoAmenity, requiere_aprobacion: e.target.checked })} />Requiere aprobación del admin</label>
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Turnos del día</p>
                {nuevoAmenity.turnos_config.length === 0 && (
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Agregá uno o más turnos con horario fijo (opcional, el {lbl.miembro} verá estos bloques).</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {nuevoAmenity.turnos_config.map((turno) => (
                    <div key={turno.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, border: '1px solid #0f172a', borderRadius: 10, padding: 12, background: '#0b1534' }}>
                      <label style={{ ...styles.modalLabel, flex: '1 1 120px' }}>
                        Desde
                        <input
                          style={styles.modalInput}
                          type="time"
                          value={turno.hora_inicio}
                          onChange={(e) => actualizarTurno(turno.id, 'hora_inicio', e.target.value)}
                        />
                      </label>
                      <label style={{ ...styles.modalLabel, flex: '1 1 120px' }}>
                        Hasta
                        <input
                          style={styles.modalInput}
                          type="time"
                          value={turno.hora_fin}
                          onChange={(e) => actualizarTurno(turno.id, 'hora_fin', e.target.value)}
                        />
                      </label>
                      <label style={{ ...styles.modalLabel, flex: '1 1 160px' }}>
                        Etiqueta (opcional)
                        <input
                          style={styles.modalInput}
                          value={turno.etiqueta}
                          onChange={(e) => actualizarTurno(turno.id, 'etiqueta', e.target.value)}
                          placeholder="Ej: Mañana"
                        />
                      </label>
                      <button style={{ ...styles.deleteButton, padding: '8px 12px', alignSelf: 'flex-end' }} onClick={() => eliminarTurno(turno.id)}>Eliminar</button>
                    </div>
                  ))}
                  <button style={{ ...styles.refreshButton, padding: '10px 14px', fontSize: 13, alignSelf: 'flex-start' }} onClick={agregarTurno}>+ Agregar turno</button>
                </div>
              </div>
              </div>
            </div>
            <div style={styles.modalButtons}>
              <button style={styles.cancelButton} onClick={cerrarModalAmenity}>Cancelar</button>
              <button style={styles.createButton} onClick={guardarAmenity}>{editandoAmenity ? 'Guardar Cambios' : 'Crear Amenity'}</button>
            </div>
          </div>
        </div>
      )}

      {showCrearEncuesta && (
        <div style={styles.modalBackdrop} onClick={() => setShowCrearEncuesta(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Nueva Encuesta</h3>
            <div style={styles.modalForm}>
              <label style={styles.modalLabel}>Título *<input style={styles.modalInput} value={nuevaEncuesta.titulo} onChange={(e) => setNuevaEncuesta({ ...nuevaEncuesta, titulo: e.target.value })} placeholder="Ej: ¿Qué mejora prefieren?" /></label>
              <label style={styles.modalLabel}>Descripción<input style={styles.modalInput} value={nuevaEncuesta.descripcion} onChange={(e) => setNuevaEncuesta({ ...nuevaEncuesta, descripcion: e.target.value })} /></label>
              <div><p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Opciones *</p>
                {nuevaEncuesta.opciones.map((op, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input style={{ ...styles.modalInput, flex: 1 }} value={op} onChange={(e) => { const opts = [...nuevaEncuesta.opciones]; opts[i] = e.target.value; setNuevaEncuesta({ ...nuevaEncuesta, opciones: opts }); }} placeholder={`Opción ${i + 1}`} />
                    {nuevaEncuesta.opciones.length > 2 && <button style={styles.deleteButton} onClick={() => { const opts = nuevaEncuesta.opciones.filter((_, idx) => idx !== i); setNuevaEncuesta({ ...nuevaEncuesta, opciones: opts }); }}>✕</button>}
                  </div>
                ))}
                <button style={{ ...styles.refreshButton, padding: '8px 12px', fontSize: 13 }} onClick={() => setNuevaEncuesta({ ...nuevaEncuesta, opciones: [...nuevaEncuesta.opciones, ''] })}>+ Agregar opción</button>
              </div>
              <label style={styles.switchLabel}><input type="checkbox" checked={nuevaEncuesta.multiple} onChange={(e) => setNuevaEncuesta({ ...nuevaEncuesta, multiple: e.target.checked })} />Permitir múltiples respuestas</label>
              <label style={styles.modalLabel}>Fecha de cierre (opcional)<input style={styles.modalInput} type="datetime-local" value={nuevaEncuesta.fecha_cierre} onChange={(e) => setNuevaEncuesta({ ...nuevaEncuesta, fecha_cierre: e.target.value })} /></label>
              <div style={styles.modalButtons}>
                <button style={styles.cancelButton} onClick={() => setShowCrearEncuesta(false)}>Cancelar</button>
                <button style={styles.createButton} onClick={crearEncuesta}>Crear Encuesta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reclamoRespuesta && (
        <div style={styles.modalBackdrop} onClick={() => setReclamoRespuesta(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Responder Reclamo</h3>
            <div style={styles.modalForm}>
              <label style={styles.modalLabel}>Tu respuesta
                <textarea style={{ ...styles.modalInput, minHeight: 100, resize: 'vertical' }} value={reclamoRespuesta.texto} onChange={(e) => setReclamoRespuesta({ ...reclamoRespuesta, texto: e.target.value })} placeholder={`Escribí tu respuesta al ${lbl.miembro}...`} />
              </label>
              <div style={styles.modalButtons}>
                <button style={styles.cancelButton} onClick={() => setReclamoRespuesta(null)}>Cancelar</button>
                <button style={styles.createButton} onClick={responderReclamo}>Enviar Respuesta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNuevaTerminal && (
        <div style={styles.modalBackdrop} onClick={() => setShowNuevaTerminal(false)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Nueva Terminal</h3>
            <label style={styles.modalLabel}>Nombre<input style={styles.modalInput} placeholder='Ej: Terminal Norte' value={nuevaTerminalNombre} onChange={e => setNuevaTerminalNombre(e.target.value)} /></label>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...styles.approveButton, flex: 1 }} onClick={crearTerminal}>Crear</button>
              <button style={{ ...styles.rejectButton, flex: 1 }} onClick={() => setShowNuevaTerminal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showNuevoPunto && (
        <div style={styles.modalBackdrop} onClick={() => { setShowNuevoPunto(null); setEditandoPunto(null); }}>
          <div style={{ ...styles.modalCard, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editandoPunto ? 'Editar Punto de Acceso' : 'Nuevo Punto de Acceso'}</h3>
            <div style={styles.modalForm}>
              <label style={styles.modalLabel}>Nombre<input style={styles.modalInput} placeholder='Ej: Entrada 1' value={nuevoPunto.nombre} onChange={e => setNuevoPunto(p => ({ ...p, nombre: e.target.value }))} /></label>
              <label style={styles.modalLabel}>Tipo de acceso
                <select style={styles.modalInput} value={nuevoPunto.tipo} onChange={e => setNuevoPunto(p => ({ ...p, tipo: e.target.value as 'IN' | 'OUT' | 'BOTH' }))}>
                  <option value='IN'>🟢 Solo Entrada (IN)</option>
                  <option value='OUT'>🔴 Solo Salida (OUT)</option>
                  <option value='BOTH'>🔵 Entrada y Salida (BOTH)</option>
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ color: '#fff', fontSize: 14 }}>Configurar barrera</span>
                <div onClick={() => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, habilitado: !p.barrera.habilitado } }))}
                  style={{ width: 40, height: 22, borderRadius: 22, cursor: 'pointer', position: 'relative', backgroundColor: nuevoPunto.barrera.habilitado ? '#3b82f6' : '#334155' }}>
                  <div style={{ position: 'absolute', height: 16, width: 16, left: nuevoPunto.barrera.habilitado ? 21 : 3, bottom: 3, backgroundColor: 'white', borderRadius: '50%' }} />
                </div>
              </div>
              {nuevoPunto.barrera.habilitado && (
                <>
                  <label style={styles.modalLabel}>Tipo de barrera
                    <select style={styles.modalInput} value={nuevoPunto.barrera.tipo} onChange={e => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, tipo: e.target.value as 'ip_relay' | 'relay_usb' | 'ninguna' } }))}>
                      <option value='ip_relay'>IP Relay (WiFi)</option>
                      <option value='relay_usb'>Relay USB</option>
                      <option value='ninguna'>Ninguna</option>
                    </select>
                  </label>
                  {nuevoPunto.barrera.tipo === 'ip_relay' && (
                    <>
                      <label style={styles.modalLabel}>IP del relay<input style={styles.modalInput} placeholder='192.168.1.50' value={nuevoPunto.barrera.ip} onChange={e => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, ip: e.target.value } }))} /></label>
                      <label style={styles.modalLabel}>Puerto<input style={styles.modalInput} type='number' placeholder='80' value={nuevoPunto.barrera.puerto} onChange={e => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, puerto: Number(e.target.value) } }))} /></label>
                      <label style={styles.modalLabel}>Endpoint<input style={styles.modalInput} placeholder='/relay/on' value={nuevoPunto.barrera.endpoint_abrir} onChange={e => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, endpoint_abrir: e.target.value } }))} /></label>
                      <label style={styles.modalLabel}>Token de autenticacion (opcional)<input style={styles.modalInput} placeholder='abc123' value={nuevoPunto.barrera.auth_token} onChange={e => setNuevoPunto(p => ({ ...p, barrera: { ...p.barrera, auth_token: e.target.value } }))} /></label>
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...styles.approveButton, flex: 1 }} onClick={guardarPunto}>Guardar</button>
              <button style={{ ...styles.rejectButton, flex: 1 }} onClick={() => { setShowNuevoPunto(null); setEditandoPunto(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR');
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function estadoColor(estado: string | null): string {
  switch (estado) {
    case 'autorizado':
      return '#22c55e';
    case 'rechazado':
      return '#ef4444';
    case 'pendiente':
      return '#eab308';
    default:
      return '#52525b';
  }
}

function rolColor(rol: string | null): string {
  switch (rol) {
    case 'admin':
      return '#8b5cf6';
    case 'guardia':
      return '#3b82f6';
    case 'vecino':
      return '#10b981';
    default:
      return '#52525b';
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0b1020',
    padding: '32px clamp(16px, 4vw, 64px)',
    color: '#f4f4ff',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  fullContainer: {
    minHeight: '100vh',
    backgroundColor: '#0b1020',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    padding: '24px 32px',
    borderRadius: 24,
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
  },
  headerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8',
  },
  headerName: {
    fontSize: 28,
    fontWeight: 700,
    margin: '8px 0 4px',
  },
  headerSub: {
    color: '#94a3b8',
  },
  barrioInfoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  spaceSwitcher: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#fff',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  newSpaceBtn: {
    border: '1px solid #3b82f6',
    color: '#3b82f6',
    background: 'transparent',
    borderRadius: 999,
    padding: '9px 18px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },
  logoutButton: {
    border: '1px solid #e94560',
    color: '#e94560',
    background: 'transparent',
    borderRadius: 999,
    padding: '10px 22px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr',
    gap: 24,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  singleColumnMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    width: '100%',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 13,
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
  },
  filterLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: '#94a3b8',
  },
  filterInput: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    padding: '12px 14px',
    background: '#0b1534',
    color: '#fff',
  },
  refreshButton: {
    borderRadius: 14,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  createButton: {
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #10b981, #34d399)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
  },
  usersList: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 400,
    overflowY: 'auto',
  },
  userRow: {
    borderRadius: 18,
    border: '1px solid #0f3460',
    background: '#0f1a3d',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userNombre: {
    fontWeight: 600,
    fontSize: 16,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  userMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  rolePill: {
    borderRadius: 999,
    padding: '4px 12px',
    fontWeight: 600,
    fontSize: 12,
    color: '#0b1020',
    textTransform: 'uppercase',
  },
  userActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  roleSelect: {
    borderRadius: 8,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    padding: '4px 8px',
    fontSize: 12,
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
  },
  solicitudRow: {
    borderRadius: 18,
    border: '1px solid #f59e0b',
    background: '#451a03',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  solicitudActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  approveButton: {
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(120deg, #22c55e, #34d399)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 12,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  rejectButton: {
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(120deg, #ef4444, #f87171)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 12,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  tableCard: {
    borderRadius: 24,
    border: '1px solid #0f3460',
    background: '#16213e',
    padding: 0,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '14px 18px',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8',
    background: '#0f1b3a',
  },
  td: {
    padding: '16px 18px',
    borderBottom: '1px solid #0f3460',
  },
  statusPill: {
    borderRadius: 999,
    padding: '4px 12px',
    fontWeight: 600,
    fontSize: 12,
    color: '#0b1020',
    textTransform: 'uppercase',
  },
  loginCard: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 700,
  },
  loginSubtitle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  loginInput: {
    borderRadius: 16,
    border: '1px solid #0f3460',
    padding: '14px 18px',
    background: '#0b1534',
    color: '#fff',
    fontSize: 16,
  },
  loginButton: {
    borderRadius: 16,
    border: 'none',
    padding: '14px 18px',
    background: 'linear-gradient(120deg, #e94560, #ff6b81)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorMsg: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyResults: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 24,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 12, 25, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    zIndex: 50,
    padding: 24,
  },
  modalCard: {
    background: '#11162a',
    borderRadius: 32,
    padding: 40,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
    border: '1px solid #25315a',
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 24,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalScrollableContent: {
    flex: 1,
    minHeight: 0,
    maxHeight: 'calc(90vh - 220px)',
    overflowY: 'auto',
    paddingRight: 6,
    scrollbarGutter: 'stable',
  },
  modalLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: '#94a3b8',
  },
  modalInput: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    padding: '12px 14px',
    background: '#0b1534',
    color: '#fff',
  },
  modalButtons: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    borderRadius: 14,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
    flex: 1,
  },
  tabBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    padding: '12px 24px',
    borderRadius: 14,
    border: '1px solid #0f3460',
    background: 'transparent',
    color: '#94a3b8',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 15,
  },
  tabActive: {
    padding: '12px 24px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #3b82f6, #6366f1)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 15,
  },
  configSection: {
    padding: 16,
    borderRadius: 16,
    border: '1px solid #0f3460',
    background: '#0f1a3d',
  },
  configSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configSectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  switchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#94a3b8',
    cursor: 'pointer',
  },
  mpConnectBtn: {
    padding: '14px 32px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #009ee3, #00b1ea)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  mpDisconnectBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #ef4444',
    background: 'transparent',
    color: '#ef4444',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
};
