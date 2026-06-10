'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, saveToken, saveUser, clearToken } from '@/lib/api';
import type { Profile } from '@/lib/supabase';
import jsQR from 'jsqr';
import { useRouter, useSearchParams } from 'next/navigation';
import { abrirBarrera, type BarrierConfig } from '@/lib/barrierControl';
import { GateScanner, type Gate } from './GateScanner';

type SearchResult = {
  invitacion_id: string;
  nombre_invitado: string;
  dni_invitado: string | null;
  patente: string | null;
  numero_casa: string | null;
  vecino_nombre: string | null;
  qr_code?: string | null;
};

type ValidationResult = {
  estado: 'autorizado' | 'rechazado' | 'pendiente';
  nombre: string | null;
  numero_casa: string | null;
  vecino_nombre: string | null;
  mensaje: string | null;
  invitacion_id: string | null;
  personal_id: string | null;
  tipo: string | null;
  dni: string | null;
};

type Ingreso = {
  id: string;
  created_at: string;
  salida_at: string | null;
  nombre_visitante: string | null;
  dni_visitante: string | null;
  casa_destino: string | null;
  tipo: string | null;
  estado: string | null;
};

function GuardiaPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terminalId = searchParams.get('terminal');

  const [terminalGates, setTerminalGates] = useState<Gate[]>([]);
  const [terminalLoaded, setTerminalLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [vecinoNotice, setVecinoNotice] = useState(false);
  const [vecinoNombre, setVecinoNombre] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<SearchResult[]>([]);

  const [estadoValidacion, setEstadoValidacion] = useState<'idle' | 'autorizado' | 'rechazado' | 'pendiente'>('idle');
  const [resultadoValidacion, setResultadoValidacion] = useState<ValidationResult | null>(null);

  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [ingresosLoading, setIngresosLoading] = useState(true);
  const [ingresosError, setIngresosError] = useState<string | null>(null);
  const [filtroCasa, setFiltroCasa] = useState('');
  const [filtroHoraInicio, setFiltroHoraInicio] = useState('00:00');
  const [filtroHoraFin, setFiltroHoraFin] = useState('23:59');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);
  const scanCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salidaModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Estado de alertas de emergencia en tiempo real
  const [alertaEmergencia, setAlertaEmergencia] = useState<{
    id: string;
    tipo: string;
    mensaje: string;
    numero_casa: string | null;
    latitud: number | null;
    longitud: number | null;
    created_at: string;
  } | null>(null);
  const alertaAudioRef = useRef<HTMLAudioElement | null>(null);

  // Estado de configuración de barrera
  const [barrierConfig, setBarrierConfig] = useState<BarrierConfig | null>(null);

  // Estado de registro de salidas
  const [registrarSalidas, setRegistrarSalidas] = useState(false);
  const [showSalidaModal, setShowSalidaModal] = useState(false);
  const [ingresoAbiertoId, setIngresoAbiertoId] = useState<string | null>(null);
  const [showCorregirModal, setShowCorregirModal] = useState(false);
  const [salidaPreviaId, setSalidaPreviaId] = useState<string | null>(null);
  const [salidaPreviaHora, setSalidaPreviaHora] = useState<string | null>(null);
  const [pendingSalidaResult, setPendingSalidaResult] = useState<ValidationResult | null>(null);

  const releaseScanLock = useCallback(() => {
    if (scanCooldownRef.current) {
      clearTimeout(scanCooldownRef.current);
    }
    scanCooldownRef.current = setTimeout(() => {
      scanLockRef.current = false;
    }, 3500);
  }, []);

  useEffect(() => {
    if (!profile?.rol) { setRedirecting(false); return; }
    if (profile.rol === 'super_admin') { setRedirecting(true); router.push('/super-admin'); }
    else if (profile.rol === 'admin') { setRedirecting(true); router.push('/admin'); }
    else if (profile.rol === 'vecino') {
      setRedirecting(true);
      setVecinoNotice(true);
      setVecinoNombre(profile.nombre || null);
      setTimeout(() => clearToken(), 500);
    } else { setRedirecting(false); }
  }, [profile?.rol, router]);

  useEffect(() => {
    const bootstrap = async () => {
      if (getToken()) await fetchProfile();
      setReady(true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    return () => {
      if (scanCooldownRef.current) clearTimeout(scanCooldownRef.current);
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
      if (salidaModalTimeoutRef.current) clearTimeout(salidaModalTimeoutRef.current);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Alertas de emergencia en tiempo real — TODO: implementar con polling o WebSocket
  // Placeholder para no romper la compilación

  // Cargar info del space (incluyendo registrar_salidas)
  useEffect(() => {
    if (!profile?.barrio_id) return;
    api.spaces.get(profile.barrio_id).then(({ space }) => {
      setRegistrarSalidas(space.registrarSalidas ?? false);
    }).catch(() => {});
  }, [profile?.barrio_id]);

  // Terminal gates — TODO: implementar endpoint de terminales
  useEffect(() => {
    if (!terminalId) return;
    setTerminalLoaded(true);
  }, [terminalId]);

  const descartarAlerta = async () => {
    if (alertaEmergencia) {
      await api.alertas.atender(alertaEmergencia.id).catch(() => {});
    }
    if (alertaAudioRef.current) {
      alertaAudioRef.current.pause();
      alertaAudioRef.current = null;
    }
    setAlertaEmergencia(null);
  };

  useEffect(() => {
    if (!profile || redirecting || profile?.rol !== 'guardia') {
      stopCamera();
      return;
    }

    const initCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Tu navegador no permite cámara');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((error: DOMException) => {
              if (error?.name !== 'AbortError') {
                console.error('camera play', error);
                setCameraError('No pudimos reproducir la cámara');
              }
            });
          }
        }
      } catch (error) {
        console.error('camera', error);
        setCameraError('No pudimos acceder a la cámara');
      }
    };

    initCamera();

    return () => {
      stopCamera();
    };
  }, [profile, redirecting, stopCamera]);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const { user } = await api.auth.me();
      const profileData: Profile = {
        id: user.id, email: user.email, nombre: user.nombre,
        rol: user.rol, barrio_id: user.barrioId ?? null,
        numero_casa: user.numeroCasa ?? null, telefono: user.telefono ?? null,
      };
      setProfile(profileData);
      return profileData;
    } catch {
      clearToken();
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
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

  useEffect(() => {
    if (!profile?.barrio_id) return;
    cargarIngresos();
  }, [profile?.barrio_id, cargarIngresos]);

  const sendPushWeb = useCallback(async (to: string, title: string, body: string, data?: Record<string, any>) => {
    try {
      const message = { to, sound: 'default', title, body, data: data || {} };
      const response = await fetch('/api/push', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        console.error('Push error (web):', response.status);
      }
    } catch (error) {
      console.error('Push send error:', error);
    }
  }, []);

  const notificarVecinosPersonal = useCallback(async (_resultado: ValidationResult) => {
    // TODO: implementar notificaciones push vía nueva API
  }, []);

  const notificarVecino = useCallback(async (_resultado: ValidationResult, _inv?: SearchResult) => {
    // TODO: implementar notificaciones push vía nueva API
  }, [notificarVecinosPersonal]);

  const resolverPendiente = useCallback(async (nuevoEstado: 'autorizado' | 'rechazado') => {
    if (!resultadoValidacion) return;
    const resultadoFinal: ValidationResult = {
      ...resultadoValidacion, estado: nuevoEstado,
      mensaje: nuevoEstado === 'autorizado' ? 'Autorizado por guardia' : 'Rechazado por guardia',
    };
    if (nuevoEstado === 'autorizado' && barrierConfig?.habilitado) {
      abrirBarrera(barrierConfig).then(r => { if (!r.success) console.warn('Barrera:', r.message); });
    }
    setEstadoValidacion(nuevoEstado);
    setResultadoValidacion(resultadoFinal);
    cargarIngresos();
  }, [resultadoValidacion, cargarIngresos, barrierConfig]);

  const handleVecinoRetry = () => {
    setVecinoNotice(false);
    setVecinoNombre(null);
    setRedirecting(false);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { token, user: u } = await api.auth.login({ email, password });
      saveToken(token);
      saveUser(u);
      const perfil = await fetchProfile();
      if (perfil?.rol === 'super_admin') { setRedirecting(true); router.push('/super-admin'); }
      else if (perfil?.rol === 'admin') { setRedirecting(true); router.push('/admin'); }
      else if (perfil?.rol === 'vecino') { setVecinoNotice(true); setVecinoNombre(perfil.nombre); }
    } catch (err: any) {
      setAuthError('Email o contraseña incorrectos');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setProfile(null);
    setProfileLoading(false);
    setRedirecting(false);
    setResultados([]);
    setEstadoValidacion('idle');
    setResultadoValidacion(null);
  };

  const buscar = async () => {
    // TODO: implementar endpoint de búsqueda de invitaciones
    setBuscando(false);
    setResultados([]);
  };

  const checkIngresoAbierto = useCallback(async (_invitacion_id: string | null, _personal_id: string | null): Promise<string | null> => {
    return null; // TODO: implementar endpoint de salidas
  }, []);

  const checkSalidaHoy = useCallback(async (_invitacion_id: string | null, _personal_id: string | null): Promise<{ id: string; salida_at: string } | null> => {
    return null; // TODO: implementar endpoint de salidas
  }, []);

  const registrarSalida = useCallback(async (_id: string) => {
    if (salidaModalTimeoutRef.current) clearTimeout(salidaModalTimeoutRef.current);
    setShowSalidaModal(false);
    setShowCorregirModal(false);
    setIngresoAbiertoId(null);
    setSalidaPreviaId(null);
    setPendingSalidaResult(null);
    cargarIngresos();
  }, [cargarIngresos]);

  const validarQrCode = useCallback(
    async (qrCode: string, inv?: SearchResult) => {
      if (!qrCode || !profile?.barrio_id || !profile?.id) {
        return;
      }

      setEstadoValidacion('pendiente');
      setResultadoValidacion(null);

      // Helper: auto-cierre del modal de salida si el guardia no toca nada (30s)
      const armSalidaTimeout = () => {
        if (salidaModalTimeoutRef.current) clearTimeout(salidaModalTimeoutRef.current);
        salidaModalTimeoutRef.current = setTimeout(() => {
          setShowSalidaModal(false);
          setShowCorregirModal(false);
          setIngresoAbiertoId(null);
          setSalidaPreviaId(null);
          setSalidaPreviaHora(null);
          setPendingSalidaResult(null);
          setEstadoValidacion('idle');
          releaseScanLock();
        }, 10000);
      };
      // Helper: mostrar modal de salida sin overlay verde (el modal es suficiente)
      const mostrarModalSalida = (invitacion_id: string, nombre: string | null, numero_casa: string | null, ingresoId: string) => {
        const r: ValidationResult = { estado: 'autorizado', nombre, numero_casa, vecino_nombre: null, mensaje: null, invitacion_id, personal_id: null, tipo: 'invitado', dni: null };
        setEstadoValidacion('idle');
        setResultadoValidacion(null);
        setIngresoAbiertoId(ingresoId);
        setPendingSalidaResult(r);
        setShowSalidaModal(true);
        armSalidaTimeout();
        releaseScanLock();
      };
      const mostrarModalCorregir = (invitacion_id: string, nombre: string | null, numero_casa: string | null, salidaId: string, salidaAt: string) => {
        const r: ValidationResult = { estado: 'autorizado', nombre, numero_casa, vecino_nombre: null, mensaje: null, invitacion_id, personal_id: null, tipo: 'invitado', dni: null };
        setEstadoValidacion('idle');
        setResultadoValidacion(null);
        setSalidaPreviaId(salidaId);
        setSalidaPreviaHora(salidaAt);
        setPendingSalidaResult(r);
        setShowCorregirModal(true);
        armSalidaTimeout();
        releaseScanLock();
      };

      let resultado: ValidationResult | null = null;
      try {
        const apiResult = await api.accesos.verificar({ qrCode, spaceId: profile.barrio_id, tipo: 'entrada' });
        resultado = {
          estado: apiResult.autorizado ? 'autorizado' : 'rechazado',
          nombre: apiResult.usuario?.nombre ?? inv?.nombre_invitado ?? null,
          numero_casa: apiResult.usuario?.numeroCasa ?? inv?.numero_casa ?? null,
          vecino_nombre: null,
          mensaje: apiResult.motivo ?? null,
          invitacion_id: inv?.invitacion_id ?? null,
          personal_id: null,
          tipo: 'invitado',
          dni: inv?.dni_invitado ?? null,
        };
      } catch {
        setEstadoValidacion('rechazado');
        setResultadoValidacion({ estado: 'rechazado', nombre: inv?.nombre_invitado ?? null, numero_casa: inv?.numero_casa ?? null, vecino_nombre: null, mensaje: 'Error al validar. Intentá nuevamente', invitacion_id: inv?.invitacion_id ?? null, personal_id: null, tipo: null, dni: null });
        return;
      }

      setEstadoValidacion(resultado.estado);
      setResultadoValidacion(resultado);

      if (resultado.estado !== 'pendiente') {
        if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = setTimeout(() => {
          setEstadoValidacion('idle');
          setResultadoValidacion(null);
        }, 5000);
      }

      if (resultado.estado === 'autorizado' && barrierConfig?.habilitado) {
        abrirBarrera(barrierConfig).then(r => { if (!r.success) console.warn('Barrera:', r.message); });
      }

      cargarIngresos();
    },
    [cargarIngresos, notificarVecino, profile?.barrio_id, profile?.id, barrierConfig, registrarSalidas, checkIngresoAbierto, checkSalidaHoy, releaseScanLock]
  );

  const validarInvitacion = async (inv: SearchResult) => {
    if (!profile?.barrio_id) return;
    const qrCode = inv.qr_code;
    if (!qrCode) {
      setEstadoValidacion('rechazado');
      setResultadoValidacion({ estado: 'rechazado', nombre: inv.nombre_invitado, numero_casa: inv.numero_casa, vecino_nombre: inv.vecino_nombre, mensaje: 'No encontramos el código QR original', invitacion_id: inv.invitacion_id, personal_id: null, tipo: 'invitado', dni: inv.dni_invitado });
      return;
    }

    validarQrCode(qrCode, inv);
  };

  const handleQrDecoded = useCallback(
    (qrContent: string) => {
      const content = qrContent?.trim();
      if (!content || scanLockRef.current) return;
      scanLockRef.current = true;
      validarQrCode(content).finally(() => {
        releaseScanLock();
      });
    },
    [releaseScanLock, validarQrCode]
  );

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
  }, [ingresos, filtroCasa, filtroHoraFin, filtroHoraInicio, filtroFechaInicio, filtroFechaFin]);

  useEffect(() => {
    if (!session) return;

    let animationId: number;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        animationId = requestAnimationFrame(scan);
        return;
      }

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationId = requestAnimationFrame(scan);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(scan);
        return;
      }

      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        handleQrDecoded(code.data);
      }

      animationId = requestAnimationFrame(scan);
    };

    animationId = requestAnimationFrame(scan);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [handleQrDecoded, session]);

  if (vecinoNotice) {
    return (
      <main style={styles.fullContainer}>
        <div style={styles.vecinoNoticeCard}>
          <p style={styles.vecinoBadge}>Área de miembros</p>
          <h1 style={styles.vecinoTitle}>Hola {vecinoNombre || 'vecino'} 👋</h1>
          <p style={styles.vecinoText}>
            Accedé a tu QR de entrada y reservas desde tu página personal.
          </p>
          <div style={styles.vecinoActions}>
            <a
              href="/mi-acceso"
              style={{ ...styles.loginButton, textDecoration: 'none', textAlign: 'center' }}
            >
              🎫 Ir a Mi Acceso
            </a>
            <button style={styles.refreshButton} onClick={handleVecinoRetry}>
              Volver al inicio
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!ready || profileLoading) {
    return (
      <main style={styles.fullContainer}>
        <p style={{ color: '#94a3b8' }}>Cargando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <div style={styles.fullContainer}>
        <form style={styles.loginCard} onSubmit={handleLogin}>
          <div style={styles.loginLogoBlock}>
            <img src="/assets/logos/qrpasssintextotransparente.png" alt="QRPass" style={styles.loginLogo} />
            <h1 style={styles.loginTitle}>Login</h1>
          </div>
          <p style={styles.loginSubtitle}>Ingresá con tu cuenta institucional</p>

          <input
            style={styles.loginInput}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.loginInput}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {authError && <p style={styles.errorMsg}>{authError}</p>}

          <button style={styles.loginButton} type="submit" disabled={authLoading}>
            {authLoading ? 'Ingresando...' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    );
  }

  if (profileLoading || !profile) {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Preparando tu panel...</p>
      </div>
    );
  }

  if (redirecting || profile.rol !== 'guardia') {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Redirigiendo a tu panel...</p>
      </div>
    );
  }

  // Modo Terminal: URL con ?terminal=UUID → grid de N cámaras automáticas
  if (terminalId) {
    if (!terminalLoaded) {
      return (
        <div style={styles.fullContainer}>
          <p style={{ color: '#94a3b8' }}>Cargando terminal...</p>
        </div>
      );
    }
    if (terminalGates.length === 0) {
      return (
        <div style={styles.fullContainer}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>🚧</p>
            <p style={{ color: '#fff', fontWeight: 700 }}>Terminal sin puntos de acceso</p>
            <p style={{ color: '#64748b', fontSize: 14 }}>Configurá los gates desde el panel de administración.</p>
          </div>
        </div>
      );
    }
    const cols = terminalGates.length <= 2 ? terminalGates.length : terminalGates.length <= 4 ? 2 : 3;
    return (
      <div style={{ minHeight: '100vh', background: '#020617', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Terminal · {terminalGates.length} punto{terminalGates.length !== 1 ? 's' : ''} de acceso</p>
          <button style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }} onClick={handleLogout}>Salir</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
          {terminalGates.map((gate, idx) => (
            <GateScanner
              key={gate.id}
              gate={gate}
              barrioId={profile.barrio_id!}
              guardiaId={profile.id}
              cameraIndex={idx}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.page}>
        <header style={styles.header}>
          <div>
            <p style={styles.headerLabel}>Guardia en turno</p>
            <h2 style={styles.headerName}>{profile?.nombre || 'Sin nombre'}</h2>
            <p style={styles.headerSub}>{profile?.barrio_id ? 'Barrio asignado ✓' : '⚠️ Sin barrio asignado'}</p>
          </div>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </header>
        <main style={styles.content}>
          <section style={styles.leftColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📷 Cámara en vivo</h3>
                <span style={styles.cardSub}>Apuntá al código QR</span>
              </div>
              <div style={styles.cameraWrapper}>
                {cameraError ? (
                  <p style={styles.cameraError}>{cameraError}</p>
                ) : (
                  <>
                    <video ref={videoRef} style={styles.camera} playsInline muted autoPlay />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </>
                )}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🔍 Búsqueda manual</h3>
                <span style={styles.cardSub}>Código, DNI, nombre o patente</span>
              </div>
              <div style={styles.searchRow}>
                <input
                  style={styles.searchInput}
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                />
                <button style={styles.searchButton} onClick={buscar} disabled={buscando}>
                  {buscando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              <div style={styles.resultsList}>
                {resultados.length === 0 && !buscando ? (
                  <p style={styles.emptyResults}>Sin resultados. Ingresá un dato.</p>
                ) : (
                  resultados.map((inv) => (
                    <button key={inv.invitacion_id} style={styles.resultRow} onClick={() => validarInvitacion(inv)}>
                      <div>
                        <p style={styles.resultNombre}>{inv.nombre_invitado}</p>
                        <p style={styles.resultMeta}>
                          Casa {inv.numero_casa || '?'} • {inv.vecino_nombre || 'Vecino'}
                        </p>
                      </div>
                      <span style={styles.resultCTA}>Validar</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section style={styles.rightColumn}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📋 Ingresos del día</h3>
                <span style={styles.cardSub}>Aplicá filtros por casa, fecha y horario</span>
              </div>
              <div style={styles.filtersRow}>
                <label style={styles.filterLabel}>
                  Casa
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
                      <th style={styles.th}>Hora</th>
                      <th style={styles.th}>Visitante</th>
                      <th style={styles.th}>DNI</th>
                      <th style={styles.th}>Casa</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Estado</th>
                      {registrarSalidas && <th style={styles.th}>Salida</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ingresosFiltrados.map((ing) => (
                      <tr key={ing.id} style={registrarSalidas && !ing.salida_at && ing.estado === 'autorizado' ? { backgroundColor: '#052e16' } : undefined}>
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
                        {registrarSalidas && (
                          <td style={styles.td}>
                            {ing.salida_at
                              ? <span style={{ color: '#94a3b8', fontSize: 12 }}>{formatHora(ing.salida_at)}</span>
                              : ing.estado === 'autorizado'
                                ? <button onClick={() => registrarSalida(ing.id)} style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>Salida</button>
                                : <span style={{ color: '#475569', fontSize: 12 }}>—</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>

    {/* Overlay de alerta de emergencia */}
    {alertaEmergencia && (
      <div style={styles.emergencyBackdrop}>
        <div style={styles.emergencyCard}>
          <div style={styles.emergencyPulse}>🚨</div>
          <h1 style={styles.emergencyTitle}>ALERTA DE EMERGENCIA</h1>
          <p style={styles.emergencyTipo}>
            {alertaEmergencia.tipo === 'emergencia' && '🚨 Emergencia General'}
            {alertaEmergencia.tipo === 'incendio' && '🔥 Incendio'}
            {alertaEmergencia.tipo === 'robo' && '🚔 Robo / Intrusión'}
            {alertaEmergencia.tipo === 'medica' && '🏥 Emergencia Médica'}
            {alertaEmergencia.tipo === 'otro' && '⚠️ Otra Emergencia'}
          </p>
          <p style={styles.emergencyMensaje}>{alertaEmergencia.mensaje}</p>
          <p style={styles.emergencyTime}>
            {new Date(alertaEmergencia.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {alertaEmergencia.latitud && alertaEmergencia.longitud && (
            <a
              href={`https://maps.google.com/?q=${alertaEmergencia.latitud},${alertaEmergencia.longitud}`}
              target="_blank"
              rel="noreferrer"
              style={styles.emergencyMapsBtn}
            >
              📍 Ver ubicación en Maps
            </a>
          )}
          <button style={styles.emergencyDismiss} onClick={descartarAlerta}>
            ✓ Marcar como atendida
          </button>
        </div>
      </div>
    )}

    {/* Modal salida: persona adentro */}
  {showSalidaModal && pendingSalidaResult && (
    <div style={styles.modalBackdrop}>
      <div style={{ ...styles.overlayCard, maxWidth: 380 }}>
        <p style={{ fontSize: 48, textAlign: 'center', margin: 0 }}>🚪</p>
        <h2 style={{ color: '#fff', textAlign: 'center', margin: '12px 0 8px' }}>Esta persona está adentro</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 24 }}>
          {pendingSalidaResult.nombre ?? 'El visitante'} ya registró entrada hoy.<br />¿Registrás la salida?
        </p>
        <button style={{ ...styles.autorizarBtn, width: '100%', marginBottom: 10 }} onClick={() => ingresoAbiertoId && registrarSalida(ingresoAbiertoId)}>
          ✓ Registrar Salida
        </button>
        <button style={{ ...styles.rechazarBtn, width: '100%' }} onClick={() => { if (salidaModalTimeoutRef.current) clearTimeout(salidaModalTimeoutRef.current); setShowSalidaModal(false); setIngresoAbiertoId(null); setPendingSalidaResult(null); releaseScanLock(); }}>
          Cancelar
        </button>
      </div>
    </div>
  )}

  {/* Modal corrección hora de salida */}
  {showCorregirModal && pendingSalidaResult && (
    <div style={styles.modalBackdrop}>
      <div style={{ ...styles.overlayCard, maxWidth: 380 }}>
        <p style={{ fontSize: 48, textAlign: 'center', margin: 0 }}>🕐</p>
        <h2 style={{ color: '#fff', textAlign: 'center', margin: '12px 0 8px' }}>Salida ya registrada</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 24 }}>
          {pendingSalidaResult.nombre ?? 'El visitante'} tiene salida a las {salidaPreviaHora ? formatHora(salidaPreviaHora) : ''}.<br />¿Actualizás la hora a ahora?
        </p>
        <button style={{ ...styles.autorizarBtn, width: '100%', marginBottom: 10 }} onClick={() => salidaPreviaId && registrarSalida(salidaPreviaId)}>
          ✓ Actualizar hora de salida
        </button>
        <button style={{ ...styles.rechazarBtn, width: '100%' }} onClick={() => { if (salidaModalTimeoutRef.current) clearTimeout(salidaModalTimeoutRef.current); setShowCorregirModal(false); setSalidaPreviaId(null); setSalidaPreviaHora(null); setPendingSalidaResult(null); releaseScanLock(); }}>
          Cancelar
        </button>
      </div>
    </div>
  )}

  {estadoValidacion !== 'idle' && resultadoValidacion && (
      <div style={styles.modalBackdrop} onClick={() => estadoValidacion !== 'pendiente' && setEstadoValidacion('idle')}>
        <div style={styles.overlayCard} onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              ...styles.overlayStatus,
              backgroundColor:
                estadoValidacion === 'autorizado' ? '#16a34a' : estadoValidacion === 'rechazado' ? '#dc2626' : '#f59e0b',
            }}
          >
            <h1 style={styles.overlayTitle}>
              {estadoValidacion === 'autorizado' && '¡AUTORIZADO!'}
              {estadoValidacion === 'rechazado' && 'NO AUTORIZADO'}
              {estadoValidacion === 'pendiente' && 'FUERA DE HORARIO'}
            </h1>
          </div>
          {resultadoValidacion.numero_casa && <p style={styles.overlayHouse}>Casa {resultadoValidacion.numero_casa}</p>}
          {resultadoValidacion.nombre && <p style={styles.overlayGuest}>{resultadoValidacion.nombre}</p>}
          {resultadoValidacion.vecino_nombre && <p style={styles.overlayNeighbor}>Visita para: {resultadoValidacion.vecino_nombre}</p>}
          {resultadoValidacion.mensaje && <p style={styles.overlayMessage}>{resultadoValidacion.mensaje}</p>}

          {estadoValidacion === 'pendiente' ? (
            <div style={styles.pendienteActions}>
              <button style={styles.autorizarBtn} onClick={() => resolverPendiente('autorizado')}>
                ✓ Autorizar ingreso
              </button>
              <button style={styles.rechazarBtn} onClick={() => resolverPendiente('rechazado')}>
                ✕ Rechazar
              </button>
            </div>
          ) : (
            <p style={styles.overlayHint} onClick={() => setEstadoValidacion('idle')}>Tocá para cerrar</p>
          )}
        </div>
      </div>
    )}
  </>
);
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
  cameraWrapper: {
    borderRadius: 20,
    border: '1px solid #0f3460',
    overflow: 'hidden',
    minHeight: 280,
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cameraError: {
    color: '#f87171',
    textAlign: 'center',
  },
  searchRow: {
    display: 'flex',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderRadius: 16,
    border: '1px solid #0f3460',
    padding: '16px 20px',
    background: '#0b1534',
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    borderRadius: 16,
    border: 'none',
    padding: '16px 24px',
    background: 'linear-gradient(120deg, #e94560, #ff6b81)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resultsList: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 260,
    overflowY: 'auto',
  },
  resultRow: {
    borderRadius: 18,
    border: '1px solid #0f3460',
    background: '#0f1a3d',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  resultNombre: {
    fontWeight: 600,
    fontSize: 16,
  },
  resultMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  resultCTA: {
    color: '#e94560',
    fontWeight: 600,
  },
  emptyResults: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 24,
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
  loginLogoBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  loginLogo: {
    width: 120,
    height: 120,
    objectFit: 'contain',
    filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.35))',
  },
  errorMsg: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  overlayCard: {
    background: '#11162a',
    borderRadius: 32,
    padding: 40,
    textAlign: 'center',
    color: '#fff',
    border: '1px solid #25315a',
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
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
  overlayStatus: {
    borderRadius: 24,
    padding: '18px 32px',
    marginBottom: 24,
    color: '#fff',
  },
  overlayTitle: {
    fontSize: 40,
    fontWeight: 800,
  },
  overlayHouse: {
    fontSize: 36,
    fontWeight: 700,
    marginTop: 16,
  },
  overlayGuest: {
    fontSize: 24,
    marginTop: 8,
  },
  overlayNeighbor: {
    fontSize: 20,
    marginTop: 8,
  },
  vecinoNoticeCard: {
    background: '#111a34',
    borderRadius: 32,
    padding: 48,
    width: '100%',
    maxWidth: 520,
    border: '1px solid #1e2a4d',
    boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    textAlign: 'center',
  },
  vecinoBadge: {
    alignSelf: 'center',
    padding: '6px 16px',
    borderRadius: 999,
    background: 'rgba(233, 69, 96, 0.15)',
    color: '#fda4af',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  vecinoTitle: {
    fontSize: 34,
    fontWeight: 700,
  },
  vecinoText: {
    color: '#cbd5f5',
    lineHeight: 1.5,
    fontSize: 16,
  },
  vecinoTextSecondary: {
    color: '#94a3b8',
    fontSize: 14,
  },
  vecinoActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  overlayMessage: {
    fontSize: 18,
    marginTop: 16,
  },
  overlayHint: {
    marginTop: 28,
    fontSize: 14,
    opacity: 0.8,
    cursor: 'pointer',
  },
  pendienteActions: {
    marginTop: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  autorizarBtn: {
    borderRadius: 16,
    border: 'none',
    padding: '18px 32px',
    background: '#22c55e',
    color: '#fff',
    fontWeight: 700,
    fontSize: 20,
    cursor: 'pointer',
  },
  rechazarBtn: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.3)',
    padding: '16px 32px',
    background: 'transparent',
    color: '#fff',
    fontWeight: 600,
    fontSize: 18,
    cursor: 'pointer',
  },
  emergencyBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(139, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 24,
    animation: 'pulse-bg 1s ease-in-out infinite alternate',
  },
  emergencyCard: {
    background: '#1a0000',
    borderRadius: 32,
    padding: 48,
    textAlign: 'center',
    color: '#fff',
    border: '3px solid #ff4444',
    boxShadow: '0 0 60px rgba(255, 0, 0, 0.5)',
    maxWidth: 500,
    width: '100%',
  },
  emergencyPulse: {
    fontSize: 72,
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 32,
    fontWeight: 800,
    color: '#ff4444',
    marginBottom: 16,
    letterSpacing: 2,
  },
  emergencyTipo: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 12,
  },
  emergencyCasa: {
    fontSize: 48,
    fontWeight: 800,
    color: '#ff6b6b',
    marginBottom: 8,
  },
  emergencyMensaje: {
    fontSize: 18,
    color: '#ffaaaa',
    marginBottom: 8,
  },
  emergencyTime: {
    fontSize: 16,
    color: '#ff8888',
    marginBottom: 24,
  },
  emergencyMapsBtn: {
    display: 'block',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
    padding: '14px 28px',
    borderRadius: 14,
    textDecoration: 'none',
    marginBottom: 16,
    textAlign: 'center',
  },
  emergencyDismiss: {
    borderRadius: 16,
    border: '2px solid #ff4444',
    background: 'transparent',
    color: '#ff4444',
    fontWeight: 700,
    fontSize: 18,
    padding: '16px 32px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

export default function GuardiaPanelPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#94a3b8' }}>Cargando...</p></div>}>
      <GuardiaPanel />
    </Suspense>
  );
}
