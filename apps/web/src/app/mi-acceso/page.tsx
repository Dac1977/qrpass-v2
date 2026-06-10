'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { api, getToken, saveToken, saveUser, clearToken } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

type Profile = {
  id: string;
  nombre: string | null;
  rol: string;
  barrio_id: string | null;
  numero_casa: string | null;
  activo: boolean;
  estado_aprobacion: string | null;
  qr_code: string | null;
};

type BarrioInfo = {
  nombre: string;
  codigo_invitacion: string | null;
};

type Amenity = {
  id: string;
  nombre: string;
  descripcion: string | null;
  capacidad: number | null;
  hora_apertura: string;
  hora_cierre: string;
  requiere_aprobacion: boolean;
  precio_reserva: number;
  turnos_config: TurnoConfig[] | null;
};

type TurnoConfig = {
  id: string;
  etiqueta: string | null;
  hora_inicio: string;
  hora_fin: string;
};

type Reserva = {
  id: string;
  amenity_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  monto: number;
  estado_pago: string | null;
  amenity_nombre?: string;
};

type ConfigPagos = {
  mp_habilitado: boolean;
  mp_access_token: string | null;
  banco_nombre: string | null;
  banco_cbu: string | null;
  banco_alias: string | null;
  banco_titular: string | null;
  transferencia_habilitada: boolean;
};

const normalizeAmenity = (amenity: any): Amenity => {
  const horaApertura = amenity?.hora_apertura ?? amenity?.horaApertura ?? '08:00';
  const horaCierre = amenity?.hora_cierre ?? amenity?.horaCierre ?? '22:00';
  const rawTurnos = Array.isArray(amenity?.turnos_config)
    ? amenity.turnos_config
    : Array.isArray(amenity?.turnosConfig)
      ? amenity.turnosConfig
      : [];

  return {
    id: amenity.id,
    nombre: amenity.nombre,
    descripcion: amenity.descripcion ?? null,
    capacidad: amenity.capacidad ?? null,
    hora_apertura: String(horaApertura).slice(0, 5),
    hora_cierre: String(horaCierre).slice(0, 5),
    requiere_aprobacion: amenity?.requiere_aprobacion ?? amenity?.requiereAprobacion ?? false,
    precio_reserva: amenity?.precio_reserva ?? amenity?.precioReserva ?? 0,
    turnos_config: rawTurnos.map((turno: any) => ({
      id: turno?.id || Math.random().toString(36).slice(2, 9),
      etiqueta: turno?.etiqueta ?? null,
      hora_inicio: String(turno?.hora_inicio ?? turno?.horaInicio ?? '08:00').slice(0, 5),
      hora_fin: String(turno?.hora_fin ?? turno?.horaFin ?? '09:00').slice(0, 5),
    })),
  };
};

const mapReservaVecino = (reserva: any): Reserva => {
  const fecha = new Date(reserva?.fecha ?? Date.now()).toISOString().split('T')[0];
  return {
    id: reserva.id,
    amenity_id: reserva.amenity_id ?? reserva.amenityId ?? reserva.amenity?.id,
    fecha,
    hora_inicio: String(reserva?.hora_inicio ?? reserva?.horaInicio ?? '').slice(0, 5),
    hora_fin: String(reserva?.hora_fin ?? reserva?.horaFin ?? '').slice(0, 5),
    estado: reserva.estado,
    monto: reserva.monto ?? 0,
    estado_pago: reserva?.estado_pago ?? reserva?.estadoPago ?? null,
    amenity_nombre: reserva?.amenity_nombre ?? reserva?.amenity?.nombre ?? 'Amenity',
  };
};

export default function MiAccesoPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barrioInfo, setBarrioInfo] = useState<BarrioInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);
  const [configPagos, setConfigPagos] = useState<ConfigPagos | null>(null);

  // Modal de reserva
  const [showReserva, setShowReserva] = useState(false);
  const [amenitySeleccionado, setAmenitySeleccionado] = useState<Amenity | null>(null);
  const [fechaReserva, setFechaReserva] = useState('');
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<TurnoConfig | null>(null);
  const [horaInicioManual, setHoraInicioManual] = useState('');
  const [horaFinManual, setHoraFinManual] = useState('');
  const [reservando, setReservando] = useState(false);
  const [reservaError, setReservaError] = useState<string | null>(null);

  // Pago
  const [pasoReserva, setPasoReserva] = useState<'fecha' | 'pago' | 'comprobante'>('fecha');
  const [metodoPago, setMetodoPago] = useState<'transferencia' | 'mercadopago' | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState('');

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      if (getToken()) await fetchProfile();
      else setReady(true);
    };
    bootstrap();
  }, []);

  const fetchProfile = async () => {
    try {
      const { user } = await api.auth.me();
      setProfile({
        id: user.id, nombre: user.nombre, rol: user.rol,
        barrio_id: user.barrioId ?? null, numero_casa: user.numeroCasa ?? null,
        activo: user.activo ?? false, estado_aprobacion: user.estadoAprobacion ?? null,
        qr_code: user.qrCode ?? null,
      });
    } catch {
      clearToken();
    }
    setReady(true);
  };

  useEffect(() => {
    if (!profile?.barrio_id || profile.rol !== 'vecino') return;
    fetchBarrioInfo(profile.barrio_id);
    fetchQrCode();
    cargarAmenities();
    cargarMisReservas();
    cargarConfigPagos();
  }, [profile?.id, profile?.barrio_id]);

  const fetchBarrioInfo = async (barrioId: string) => {
    try {
      const { space } = await api.spaces.get(barrioId);
      setBarrioInfo({ nombre: space.nombre, codigo_invitacion: space.codigoInvitacion ?? null });
    } catch {}
  };

  const fetchQrCode = async () => {
    if (!profile?.id) return;
    setQrLoading(true);
    if (profile.qr_code) {
      setQrCode(profile.qr_code);
    }
    setQrLoading(false);
  };

  const cargarAmenities = async () => {
    if (!profile?.barrio_id) return;
    try {
      const { amenities: data } = await api.amenities.porSpace(profile.barrio_id);
      setAmenities((data || []).filter((a) => a.activo !== false).map(normalizeAmenity));
    } catch (error) {
      console.error('No pudimos cargar los amenities', error);
    }
  };

  const cargarMisReservas = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { reservas } = await api.reservas.mis();
      setMisReservas((reservas || []).map(mapReservaVecino));
    } catch (error) {
      console.error('No pudimos cargar tus reservas', error);
    }
  }, [profile?.id]);

  const cargarConfigPagos = async () => {
    // TODO: implementar endpoint de config pagos
  };

  const abrirReserva = (amenity: Amenity) => {
    setAmenitySeleccionado(amenity);
    setFechaReserva('');
    setTurnoSeleccionado(null);
    setHoraInicioManual('');
    setHoraFinManual('');
    setReservaError(null);
    setMetodoPago(null);
    setComprobanteUrl('');
    setPasoReserva('fecha');
    setShowReserva(true);
  };

  const confirmarReserva = async () => {
    if (!profile?.id || !profile?.barrio_id || !amenitySeleccionado || !fechaReserva) {
      setReservaError('Completá todos los campos');
      return;
    }
    const horaInicio = turnoSeleccionado ? turnoSeleccionado.hora_inicio.slice(0, 5) : horaInicioManual;
    const horaFin = turnoSeleccionado ? turnoSeleccionado.hora_fin.slice(0, 5) : horaFinManual;
    if (!horaInicio || !horaFin) {
      setReservaError('Seleccioná un turno o ingresá el horario');
      return;
    }

    const precio = amenitySeleccionado.precio_reserva || 0;
    if (precio > 0) {
      if (pasoReserva === 'fecha') {
        setPasoReserva('pago');
        return;
      }
      if (pasoReserva === 'pago') {
        if (!metodoPago) {
          setReservaError('Elegí un método de pago');
          return;
        }
        if (metodoPago === 'transferencia') {
          setPasoReserva('comprobante');
          return;
        }
      }
    }

    setReservando(true);
    setReservaError(null);

    try {
      await api.reservas.crear({
        amenityId: amenitySeleccionado.id,
        fecha: new Date(`${fechaReserva}T00:00:00`).toISOString(),
        horaInicio,
        horaFin,
        monto: precio,
        metodoPago: metodoPago || 'sin_costo',
        comprobante: comprobanteUrl || undefined,
        notas: undefined,
      });
      await cargarMisReservas();
      setTurnoSeleccionado(null);
      setHoraInicioManual('');
      setHoraFinManual('');
      setMetodoPago(null);
      setComprobanteUrl('');
      setFechaReserva('');
      setPasoReserva('fecha');
      setShowReserva(false);
    } catch (error: any) {
      console.error('Error al crear reserva', error);
      setReservaError(error?.message || 'No pudimos registrar la reserva');
    } finally {
      setReservando(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { token, user } = await api.auth.login({ email, password });
      saveToken(token);
      saveUser(user);
      await fetchProfile();
    } catch {
      setAuthError('Email o contraseña incorrectos');
    }
    setAuthLoading(false);
  };

  const hoy = new Date().toISOString().split('T')[0];

  // ─── RENDERS ────────────────────────────────────────────────────

  if (!ready) return <div style={s.loader}><p style={{ color: '#94a3b8' }}>Cargando...</p></div>;

  if (!profile) return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <div style={s.logoRow}>
          <img src="/assets/logos/qrpasssintextotransparente.png" alt="QRPass" style={{ height: 44, width: 44 }} />
          <span style={s.logoText}>Mi Acceso</span>
        </div>
        <p style={s.loginSub}>Ingresá con tu cuenta para ver tu QR y reservar espacios</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={s.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
          {authError && <p style={s.error}>{authError}</p>}
          <button style={s.primaryBtn} type="submit" disabled={authLoading}>{authLoading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );

  if (profile?.rol !== 'vecino') return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <h2 style={{ color: '#f1f5f9', marginBottom: 12 }}>⚠️ Acceso no disponible</h2>
        <p style={s.loginSub}>Esta página es solo para miembros. Tu rol es: <strong>{profile?.rol}</strong></p>
        <button style={s.secondaryBtn} onClick={() => { clearToken(); setProfile(null); }}>Cerrar sesión</button>
      </div>
    </div>
  );

  if (!profile?.activo || profile?.estado_aprobacion !== 'aprobado') return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <h2 style={{ color: '#f1f5f9', marginBottom: 12 }}>⏳ Cuenta pendiente</h2>
        <p style={s.loginSub}>Tu cuenta aún no fue aprobada por el administrador. Te avisarán cuando esté activa.</p>
        <button style={s.secondaryBtn} onClick={() => { clearToken(); setProfile(null); }}>Cerrar sesión</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div>
          <p style={s.headerLabel}>{barrioInfo?.nombre || 'Mi organización'}</p>
          <h2 style={s.headerName}>{profile?.nombre || 'Mi perfil'}</h2>
          {profile?.numero_casa && <p style={s.headerSub}>Unidad / Casa: {profile.numero_casa}</p>}
        </div>
        <button style={s.logoutBtn} onClick={() => { clearToken(); setProfile(null); }}>Salir</button>
      </header>

      <main style={s.main}>
        {/* QR CODE */}
        <section style={s.qrCard}>
          <p style={s.qrTitle}>🎫 Tu código de acceso</p>
          <p style={s.qrSub}>Mostralo en la entrada para ingresar</p>
          {qrLoading ? (
            <div style={s.qrPlaceholder}><p style={{ color: '#64748b' }}>Generando QR...</p></div>
          ) : qrCode ? (
            <div style={s.qrWrapper}>
              <QRCodeSVG value={qrCode} size={220} bgColor="#ffffff" fgColor="#0f172a" level="H" />
            </div>
          ) : (
            <div style={s.qrPlaceholder}><p style={{ color: '#ef4444' }}>No se pudo generar el QR</p></div>
          )}
          <p style={s.qrHint}>Mantené la pantalla encendida al mostrarlo</p>
        </section>

        {/* MIS RESERVAS PRÓXIMAS */}
        {misReservas.length > 0 && (
          <section style={s.section}>
            <h3 style={s.sectionTitle}>📅 Mis próximas reservas</h3>
            <div style={s.reservasList}>
              {misReservas.map(r => (
                <div key={r.id} style={s.reservaRow}>
                  <div>
                    <p style={s.reservaNombre}>{r.amenity_nombre}</p>
                    <p style={s.reservaMeta}>
                      {new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} •{' '}
                      {r.hora_inicio?.slice(0, 5)} – {r.hora_fin?.slice(0, 5)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ ...s.badge, background: estadoBg(r.estado), color: estadoColor(r.estado) }}>{r.estado}</span>
                    {r.monto > 0 && (
                      <span style={{ fontSize: 11, color: r.estado_pago === 'pagado' ? '#22c55e' : '#f59e0b' }}>
                        ${r.monto} · {r.estado_pago === 'pagado' ? 'Pagado' : 'Pago pendiente'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AMENITIES */}
        {amenities.length > 0 && (
          <section style={s.section}>
            <h3 style={s.sectionTitle}>🏟️ Reservar un espacio</h3>
            <div style={s.amenitiesGrid}>
              {amenities.map(a => (
                <div key={a.id} style={s.amenityCard}>
                  <p style={s.amenityNombre}>{a.nombre}</p>
                  {a.descripcion && <p style={s.amenityDesc}>{a.descripcion}</p>}
                  <div style={s.amenityMeta}>
                    <span>🕐 {a.hora_apertura?.slice(0,5)} – {a.hora_cierre?.slice(0,5)}</span>
                    {a.capacidad && <span>👥 Cap. {a.capacidad}</span>}
                  </div>
                  {a.precio_reserva > 0 ? (
                    <p style={s.amenityPrecio}>💳 ${a.precio_reserva} por reserva</p>
                  ) : (
                    <p style={{ ...s.amenityPrecio, color: '#22c55e' }}>✅ Sin costo adicional</p>
                  )}
                  <button style={s.reservarBtn} onClick={() => abrirReserva(a)}>Reservar</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* MODAL DE RESERVA */}
      {showReserva && amenitySeleccionado && (
        <div style={s.backdrop} onClick={() => setShowReserva(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Reservar — {amenitySeleccionado.nombre}</h3>

            {pasoReserva === 'fecha' && (
              <>
                <label style={s.label}>
                  Fecha
                  <input style={s.input} type="date" min={hoy} value={fechaReserva} onChange={e => setFechaReserva(e.target.value)} />
                </label>

                {amenitySeleccionado.turnos_config && amenitySeleccionado.turnos_config.length > 0 ? (
                  <div>
                    <p style={s.label}>Turno</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      {amenitySeleccionado.turnos_config.map(t => (
                        <button
                          key={t.id}
                          style={{ ...s.turnoBtn, ...(turnoSeleccionado?.id === t.id ? s.turnoBtnActive : {}) }}
                          onClick={() => setTurnoSeleccionado(t)}
                        >
                          {t.etiqueta || `${t.hora_inicio.slice(0,5)}–${t.hora_fin.slice(0,5)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ ...s.label, flex: 1 }}>
                      Desde
                      <input style={s.input} type="time" value={horaInicioManual} onChange={e => setHoraInicioManual(e.target.value)} />
                    </label>
                    <label style={{ ...s.label, flex: 1 }}>
                      Hasta
                      <input style={s.input} type="time" value={horaFinManual} onChange={e => setHoraFinManual(e.target.value)} />
                    </label>
                  </div>
                )}

                {amenitySeleccionado.precio_reserva > 0 && (
                  <div style={s.precioBox}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#f1f5f9' }}>💳 Costo: ${amenitySeleccionado.precio_reserva}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Al continuar podrás elegir el método de pago</p>
                  </div>
                )}
              </>
            )}

            {pasoReserva === 'pago' && (
              <>
                <p style={{ color: '#94a3b8', marginBottom: 16 }}>Elegí cómo pagar <strong style={{ color: '#f1f5f9' }}>${amenitySeleccionado.precio_reserva}</strong></p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {configPagos?.mp_habilitado && (
                    <button
                      style={{ ...s.pagoBtn, ...(metodoPago === 'mercadopago' ? s.pagoBtnActive : {}) }}
                      onClick={() => setMetodoPago('mercadopago')}
                    >
                      🟠 Mercado Pago
                    </button>
                  )}
                  {configPagos?.transferencia_habilitada && (
                    <button
                      style={{ ...s.pagoBtn, ...(metodoPago === 'transferencia' ? s.pagoBtnActive : {}) }}
                      onClick={() => { setMetodoPago('transferencia'); setPasoReserva('comprobante'); }}
                    >
                      🏦 Transferencia bancaria
                    </button>
                  )}
                  {!configPagos?.mp_habilitado && !configPagos?.transferencia_habilitada && (
                    <p style={{ color: '#f59e0b', fontSize: 13 }}>El administrador aún no configuró métodos de pago. Coordiná el pago directamente.</p>
                  )}
                </div>
              </>
            )}

            {pasoReserva === 'comprobante' && configPagos && (
              <>
                <div style={s.transferenciaBox}>
                  <p style={s.transferenciaLabel}>Datos bancarios</p>
                  {configPagos.banco_titular && <p style={s.transferenciaItem}>Titular: <strong>{configPagos.banco_titular}</strong></p>}
                  {configPagos.banco_cbu && <p style={s.transferenciaItem}>CBU: <strong>{configPagos.banco_cbu}</strong></p>}
                  {configPagos.banco_alias && <p style={s.transferenciaItem}>Alias: <strong>{configPagos.banco_alias}</strong></p>}
                  <p style={{ ...s.transferenciaItem, color: '#f59e0b' }}>Monto: <strong>${amenitySeleccionado.precio_reserva}</strong></p>
                </div>
                <label style={s.label}>
                  URL del comprobante (opcional)
                  <input style={s.input} type="url" placeholder="https://..." value={comprobanteUrl} onChange={e => setComprobanteUrl(e.target.value)} />
                </label>
              </>
            )}

            {reservaError && <p style={s.error}>{reservaError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={s.secondaryBtn} onClick={() => setShowReserva(false)}>Cancelar</button>
              <button style={s.primaryBtn} onClick={confirmarReserva} disabled={reservando}>
                {reservando ? 'Reservando...' : pasoReserva === 'fecha' && amenitySeleccionado.precio_reserva > 0 ? 'Continuar →' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function estadoBg(estado: string) {
  switch (estado) {
    case 'confirmada': return '#14532d';
    case 'pendiente': return '#713f12';
    case 'cancelada': return '#1e293b';
    default: return '#1e293b';
  }
}

function estadoColor(estado: string) {
  switch (estado) {
    case 'confirmada': return '#4ade80';
    case 'pendiente': return '#fbbf24';
    case 'cancelada': return '#94a3b8';
    default: return '#94a3b8';
  }
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
  loader: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loginCard: { maxWidth: 420, margin: '0 auto', padding: '60px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoText: { fontSize: 22, fontWeight: 800, color: '#f1f5f9' },
  loginSub: { fontSize: 15, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #1e293b', background: 'rgba(15,23,42,0.95)', position: 'sticky', top: 0, zIndex: 10 },
  headerLabel: { fontSize: 12, color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 },
  headerName: { fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0' },
  headerSub: { fontSize: 13, color: '#94a3b8', margin: '2px 0 0' },
  logoutBtn: { background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  main: { maxWidth: 600, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  qrCard: { background: '#1a1a2e', borderRadius: 20, padding: 28, border: '1px solid #1e3a5f', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  qrTitle: { fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 },
  qrSub: { fontSize: 14, color: '#94a3b8', margin: 0 },
  qrWrapper: { background: '#ffffff', borderRadius: 16, padding: 16, marginTop: 4 },
  qrPlaceholder: { width: 252, height: 252, background: '#0f172a', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155' },
  qrHint: { fontSize: 12, color: '#475569', margin: 0, textAlign: 'center' },
  section: { background: '#1a1a2e', borderRadius: 16, padding: 20, border: '1px solid #1e293b' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px' },
  reservasList: { display: 'flex', flexDirection: 'column', gap: 10 },
  reservaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e293b' },
  reservaNombre: { fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px', fontSize: 14 },
  reservaMeta: { fontSize: 12, color: '#94a3b8', margin: 0 },
  badge: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 8px' },
  amenitiesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  amenityCard: { background: '#0f172a', borderRadius: 12, padding: 16, border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 6 },
  amenityNombre: { fontWeight: 700, color: '#f1f5f9', margin: 0, fontSize: 15 },
  amenityDesc: { fontSize: 13, color: '#94a3b8', margin: 0 },
  amenityMeta: { display: 'flex', gap: 12, fontSize: 12, color: '#64748b' },
  amenityPrecio: { fontSize: 13, color: '#f59e0b', margin: '4px 0 0', fontWeight: 600 },
  reservarBtn: { marginTop: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { background: '#1a1a2e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#94a3b8', fontWeight: 500, marginBottom: 12 },
  input: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none' },
  error: { color: '#ef4444', fontSize: 13, margin: '4px 0' },
  primaryBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer', flex: 1 },
  secondaryBtn: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  turnoBtn: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  turnoBtnActive: { background: '#1d4ed8', border: '1px solid #3b82f6', color: '#fff' },
  precioBox: { background: '#1e293b', borderRadius: 10, padding: '12px 14px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 },
  pagoBtn: { background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px', color: '#94a3b8', fontSize: 15, cursor: 'pointer', fontWeight: 600, textAlign: 'left' },
  pagoBtnActive: { border: '1px solid #3b82f6', color: '#f1f5f9', background: '#172554' },
  transferenciaBox: { background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 },
  transferenciaLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' },
  transferenciaItem: { fontSize: 14, color: '#94a3b8', margin: 0 },
};
