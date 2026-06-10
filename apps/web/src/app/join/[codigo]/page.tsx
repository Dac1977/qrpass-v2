'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

const SPACE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  residential: { label: 'Barrio Cerrado', icon: '🏘️', color: '#3b82f6' },
  gym:         { label: 'Gimnasio',       icon: '🏋️', color: '#f59e0b' },
  club:        { label: 'Club',           icon: '🏊', color: '#8b5cf6' },
  event:       { label: 'Evento',         icon: '🎪', color: '#e94560' },
  coworking:   { label: 'Coworking',      icon: '💼', color: '#10b981' },
  other:       { label: 'Espacio',        icon: '🏢', color: '#64748b' },
};

type SpaceInfo = { id: string; nombre: string; space_type: string };
type SessionUser = { id: string; email: string; nombre: string } | null;

export default function JoinPage() {
  const params  = useParams();
  const router  = useRouter();
  const codigo  = (params?.codigo as string)?.toUpperCase() ?? '';

  const [space,       setSpace]       = useState<SpaceInfo | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [invalid,     setInvalid]     = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser>(null);

  // Estado del flujo "unirse" para usuarios ya logueados
  const [numeroUnidad, setNumeroUnidad] = useState('');
  const [joining,      setJoining]      = useState(false);
  const [joinResult,   setJoinResult]   = useState<'success' | 'already' | 'error' | null>(null);
  const [joinMsg,      setJoinMsg]      = useState('');

  useEffect(() => {
    if (!codigo) return;
    (async () => {
      try {
        const { space: s } = await api.spaces.byCode(codigo);
        setSpace({ id: s.id, nombre: s.nombre, space_type: s.spaceType ?? 'residential' });
      } catch {
        setInvalid(true);
      }

      if (getToken()) {
        try {
          const { user } = await api.auth.me();
          setSessionUser({ id: user.id, email: user.email, nombre: user.nombre });
        } catch { /* token inválido */ }
      }

      setLoading(false);
    })();
  }, [codigo]);

  const handleJoin = async () => {
    if (!sessionUser) return;
    setJoining(true);
    try {
      await api.spaces.join({ codigoInvitacion: codigo, numeroUnidad: numeroUnidad || undefined });
      setJoinResult('success');
      setJoinMsg(`Solicitud enviada a ${space?.nombre}. El administrador debe aprobarte.`);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('ya')) {
        setJoinResult('already');
        setJoinMsg('Ya tenés una membresía en este espacio.');
      } else {
        setJoinResult('error');
        setJoinMsg(err.message ?? 'Error al enviar solicitud.');
      }
    }
    setJoining(false);
  };

  const deepLink = `qrpass://join/${codigo}`;
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.diego1977.barriosapp';
  const appStoreUrl  = 'https://apps.apple.com/app/qrpass/id000000000';

  const tryOpenApp = () => {
    window.location.href = deepLink;
    setTimeout(() => {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/.test(ua)) window.location.href = playStoreUrl;
      else window.location.href = appStoreUrl;
    }, 2000);
  };

  const spaceInfo = space ? (SPACE_LABELS[space.space_type] ?? SPACE_LABELS.other) : null;

  if (loading) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.spinner} />
        <p style={s.subtitle}>Verificando código...</p>
      </div>
    </div>
  );

  if (invalid || !space) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.iconBig}>❌</div>
        <h1 style={s.title}>Código inválido</h1>
        <p style={s.subtitle}>El código de invitación no existe o expiró. Pedile uno nuevo al administrador.</p>
        <a href="/" style={s.link}>Ir al inicio</a>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ ...s.badge, backgroundColor: spaceInfo!.color + '20', border: `1px solid ${spaceInfo!.color}40` }}>
          <span style={{ color: spaceInfo!.color, fontSize: 13, fontWeight: 700 }}>
            {spaceInfo!.icon} {spaceInfo!.label}
          </span>
        </div>

        <h1 style={s.title}>{space.nombre}</h1>

        <div style={s.codeBox}>
          <p style={s.codeLabel}>Código de invitación</p>
          <p style={s.code}>{codigo}</p>
        </div>

        {/* ── Usuario ya logueado ── */}
        {sessionUser ? (
          <>
            <div style={s.sessionBox}>
              <span style={s.sessionIcon}>👤</span>
              <div>
                <p style={s.sessionName}>{sessionUser.nombre}</p>
                <p style={s.sessionEmail}>{sessionUser.email}</p>
              </div>
            </div>

            {joinResult ? (
              <div style={{ ...s.resultBox, borderColor: joinResult === 'error' ? '#ef4444' : '#22c55e' }}>
                <p style={{ color: joinResult === 'error' ? '#fca5a5' : '#86efac', margin: 0, fontSize: 14 }}>
                  {joinResult === 'success' ? '✅ ' : joinResult === 'already' ? 'ℹ️ ' : '❌ '}
                  {joinMsg}
                </p>
                {joinResult === 'success' && (
                  <a href="/mi-acceso" style={{ ...s.primaryBtn, display: 'block', marginTop: 16, textDecoration: 'none' }}>
                    Ver mi QR →
                  </a>
                )}
              </div>
            ) : (
              <>
                <p style={s.subtitle}>Ya tenés cuenta. ¿Querés unirte a este espacio?</p>
                <input
                  style={s.unitInput}
                  type="text"
                  placeholder="N° de unidad / casillero (opcional)"
                  value={numeroUnidad}
                  onChange={e => setNumeroUnidad(e.target.value)}
                />
                <button style={s.primaryBtn} onClick={handleJoin} disabled={joining}>
                  {joining ? 'Enviando solicitud...' : `Unirme a ${space.nombre}`}
                </button>
                <button style={s.ghostBtn} onClick={() => router.push('/mi-acceso')}>
                  Ir a mi cuenta
                </button>
              </>
            )}
          </>
        ) : (
          /* ── Usuario no logueado ── */
          <>
            <p style={s.subtitle}>Te invitaron a unirte. Elegí cómo querés registrarte.</p>

            <a href={`/register?codigo=${codigo}`} style={s.primaryBtn}>
              🌐 Registrarme desde el navegador
            </a>

            <p style={s.orText}>¿Ya tenés cuenta? <a href={`/admin?redirect=/join/${codigo}`} style={{ color: '#3b82f6' }}>Iniciá sesión</a></p>

            <p style={s.orText}>o usá la app móvil para más funciones</p>

            <button style={s.secondaryBtn} onClick={tryOpenApp}>
              📱 Abrir / Descargar la App
            </button>

            <div style={s.storeRow}>
              <a href={playStoreUrl} style={s.storeBtn} target="_blank" rel="noreferrer">
                <span style={s.storeIcon}>▶</span>
                <span>
                  <span style={s.storeSmall}>Disponible en</span><br />
                  <span style={s.storeName}>Google Play</span>
                </span>
              </a>
              <a href={appStoreUrl} style={s.storeBtn} target="_blank" rel="noreferrer">
                <span style={s.storeIcon}></span>
                <span>
                  <span style={s.storeSmall}>Disponible en</span><br />
                  <span style={s.storeName}>App Store</span>
                </span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', backgroundColor: '#0b1020', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' },
  card:       { background: '#16213e', border: '1px solid #1e3a5f', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  badge:      { display: 'inline-block', borderRadius: 20, padding: '6px 14px', marginBottom: 20 },
  title:      { fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 0 10px' },
  subtitle:   { fontSize: 15, color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 },
  codeBox:    { background: '#0b1534', border: '2px dashed #334155', borderRadius: 16, padding: '16px 24px', marginBottom: 24 },
  codeLabel:  { fontSize: 12, color: '#64748b', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 },
  code:       { fontSize: 32, fontWeight: 800, color: '#3b82f6', letterSpacing: 4, margin: 0 },
  primaryBtn: { width: '100%', padding: '14px 0', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 16 },
  orText:     { fontSize: 13, color: '#475569', margin: '0 0 16px' },
  storeRow:   { display: 'flex', gap: 12, marginBottom: 24 },
  storeBtn:   { flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '10px 14px', textDecoration: 'none', color: '#fff' },
  storeIcon:  { fontSize: 22 },
  storeSmall: { fontSize: 10, color: '#94a3b8' },
  storeName:  { fontSize: 14, fontWeight: 600 },
  hint:       { fontSize: 13, color: '#475569', lineHeight: 1.6 },
  secondaryBtn: { width: '100%', padding: '12px 0', background: 'transparent', border: '1px solid #334155', borderRadius: 14, color: '#94a3b8', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 16 },
  iconBig:    { fontSize: 56, marginBottom: 16 },
  link:       { color: '#3b82f6', fontSize: 14, fontWeight: 600, textDecoration: 'none' },
  spinner:    { width: 40, height: 40, border: '3px solid #1e293b', borderTop: '3px solid #3b82f6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' },
  sessionBox: { display: 'flex', alignItems: 'center', gap: 12, background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 12, padding: '12px 16px', marginBottom: 20, textAlign: 'left' as const },
  sessionIcon:{ fontSize: 28 },
  sessionName:{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' },
  sessionEmail:{ margin: 0, fontSize: 12, color: '#64748b' },
  unitInput:  { width: '100%', padding: '12px 16px', background: '#0b1534', border: '1px solid #334155', borderRadius: 12, color: '#fff', fontSize: 15, marginBottom: 12, boxSizing: 'border-box' as const },
  ghostBtn:   { width: '100%', padding: '11px 0', background: 'transparent', border: 'none', borderRadius: 14, color: '#475569', fontSize: 14, cursor: 'pointer', marginTop: 4 },
  resultBox:  { background: '#0f172a', border: '1px solid #22c55e', borderRadius: 12, padding: '16px', marginTop: 8 },
};
