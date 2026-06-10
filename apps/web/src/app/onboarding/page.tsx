'use client';

import { useState } from 'react';
import { api, saveToken, saveUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

const SPACE_TYPES = [
  { value: 'residential', label: 'Barrio Cerrado', icon: '🏘️', desc: 'Residencial con control de acceso' },
  { value: 'gym',         label: 'Gimnasio',        icon: '🏋️', desc: 'Socios y turnos de clase' },
  { value: 'club',        label: 'Club',             icon: '🏊', desc: 'Socios y amenities' },
  { value: 'event',       label: 'Evento',           icon: '🎪', desc: 'Entradas y control de acceso' },
  { value: 'coworking',   label: 'Coworking',        icon: '💼', desc: 'Miembros y escritorios' },
  { value: 'other',       label: 'Otro',             icon: '🏢', desc: 'Espacio genérico' },
];

type Step = 'cuenta' | 'organizacion' | 'space' | 'exito';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]   = useState<Step>('cuenta');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [cuenta, setCuenta] = useState({ nombre: '', email: '', password: '', confirm: '' });
  const [org, setOrg]       = useState({ nombre: '', slug: '' });
  const [space, setSpace]   = useState({ nombre: '', space_type: 'residential', direccion: '', precio: '' });
  const [resultado, setResultado] = useState<{ codigo: string; spaceName: string } | null>(null);

  const autoSlug = (nombre: string) =>
    nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /* ── PASO 1: crear cuenta ── */
  const handleCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (cuenta.password !== cuenta.confirm) { setError('Las contraseñas no coinciden'); return; }
    if (cuenta.password.length < 6)          { setError('Mínimo 6 caracteres'); return; }
    setStep('organizacion');
  };

  /* ── PASO 2: datos de org ── */
  const handleOrg = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!org.slug.trim()) { setError('El identificador es obligatorio'); return; }
    setStep('space');
  };

  /* ── PASO 3: crear todo ── */
  const handleSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Crear usuario (onboarding = true para crear admin sin espacio)
      const { token, user } = await api.auth.register({
        email: cuenta.email.trim(),
        password: cuenta.password,
        nombre: cuenta.nombre.trim(),
        onboarding: true,
      });
      saveToken(token);
      saveUser(user);

      // 2. Crear organización
      const { organization } = await api.organizations.create({
        nombre: org.nombre.trim(),
        slug:   org.slug.trim(),
      });

      // 3. Crear espacio dentro de la org
      const { space: newSpace } = await api.spaces.create({
        nombre:         space.nombre.trim(),
        organizationId: organization.id,
        spaceType:      space.space_type,
        direccion:      space.direccion.trim() || undefined,
        precioPorCasa:  parseInt(space.precio || '0', 10),
      });

      // 4. Actualizar barrioId del usuario y crear membership como admin
      await api.users.update(user.id, { barrioId: newSpace.id });
      await api.spaces.join({ codigoInvitacion: newSpace.codigoInvitacion, numeroUnidad: 'ADMIN' });

      setResultado({ codigo: newSpace.codigoInvitacion, spaceName: space.nombre.trim() });
      setStep('exito');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['cuenta', 'organizacion', 'space'];
  const stepIdx = STEPS.indexOf(step);

  if (step === 'exito' && resultado) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.successIcon}>🎉</div>
        <h1 style={s.title}>¡Todo listo!</h1>
        <p style={s.subtitle}>Tu espacio <strong style={{ color: '#fff' }}>{resultado.spaceName}</strong> fue creado.</p>

        <div style={s.codeBox}>
          <p style={s.codeLabel}>Código de invitación para tus miembros</p>
          <p style={s.code}>{resultado.codigo}</p>
          <p style={s.codeHint}>Compartilo para que puedan unirse desde la app</p>
        </div>

        <div style={s.actionRow}>
          <a
            href={`/join/${resultado.codigo}`}
            style={s.secondaryBtn}
            target="_blank" rel="noreferrer"
          >
            🔗 Ver link de invitación
          </a>
          <button style={s.primaryBtn} onClick={() => router.push('/admin')}>
            Ir al panel →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.logoRow}>
          <span style={s.logo}>QRPass</span>
        </div>
        <h1 style={s.title}>
          {step === 'cuenta'       ? 'Creá tu cuenta'      :
           step === 'organizacion' ? 'Tu organización'      :
                                    'Tu espacio'}
        </h1>
        <p style={s.subtitle}>
          {step === 'cuenta'       ? 'Empezá gratis, sin tarjeta de crédito' :
           step === 'organizacion' ? 'Datos de tu empresa o proyecto'         :
                                    'El lugar físico que querés gestionar'}
        </p>

        {/* Progress */}
        <div style={s.progress}>
          {['Cuenta', 'Organización', 'Espacio'].map((label, i) => (
            <div key={i} style={s.progressStep}>
              <div style={{
                ...s.progressDot,
                backgroundColor: i <= stepIdx ? '#3b82f6' : '#1e293b',
                border: `2px solid ${i <= stepIdx ? '#3b82f6' : '#334155'}`,
              }}>
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <span style={{ ...s.progressLabel, color: i <= stepIdx ? '#fff' : '#475569' }}>{label}</span>
            </div>
          ))}
          <div style={s.progressLine} />
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {/* ── PASO 1 ── */}
        {step === 'cuenta' && (
          <form onSubmit={handleCuenta} style={s.form}>
            <label style={s.label}>Nombre completo
              <input style={s.input} required value={cuenta.nombre}
                onChange={e => setCuenta({ ...cuenta, nombre: e.target.value })}
                placeholder="Juan García" />
            </label>
            <label style={s.label}>Email
              <input style={s.input} type="email" required value={cuenta.email}
                onChange={e => setCuenta({ ...cuenta, email: e.target.value })}
                placeholder="juan@empresa.com" />
            </label>
            <div style={s.row}>
              <label style={s.label}>Contraseña
                <input style={s.input} type="password" required minLength={6} value={cuenta.password}
                  onChange={e => setCuenta({ ...cuenta, password: e.target.value })} />
              </label>
              <label style={s.label}>Confirmar
                <input style={s.input} type="password" required minLength={6} value={cuenta.confirm}
                  onChange={e => setCuenta({ ...cuenta, confirm: e.target.value })} />
              </label>
            </div>
            <button style={s.primaryBtn} type="submit">Continuar →</button>
          </form>
        )}

        {/* ── PASO 2 ── */}
        {step === 'organizacion' && (
          <form onSubmit={handleOrg} style={s.form}>
            <label style={s.label}>Nombre de la organización
              <input style={s.input} required value={org.nombre}
                onChange={e => {
                  const n = e.target.value;
                  setOrg({ nombre: n, slug: autoSlug(n) });
                }}
                placeholder="Ej: Barrios del Sur S.A." />
            </label>
            <label style={s.label}>
              Identificador único (URL)
              <input style={{ ...s.input, ...s.slugInput }} required value={org.slug}
                onChange={e => setOrg({ ...org, slug: autoSlug(e.target.value) })}
                placeholder="barrios-del-sur" />
              <span style={s.slugPreview}>qrpass.app/org/{org.slug || '...'}</span>
            </label>
            <div style={s.btnRow}>
              <button type="button" style={s.backBtn} onClick={() => setStep('cuenta')}>← Volver</button>
              <button style={s.primaryBtn} type="submit">Continuar →</button>
            </div>
          </form>
        )}

        {/* ── PASO 3 ── */}
        {step === 'space' && (
          <form onSubmit={handleSpace} style={s.form}>
            <label style={s.label}>Nombre del espacio
              <input style={s.input} required value={space.nombre}
                onChange={e => setSpace({ ...space, nombre: e.target.value })}
                placeholder="Ej: Barrio Los Pinos" />
            </label>
            <label style={s.label}>Tipo de espacio</label>
            <div style={s.typeGrid}>
              {SPACE_TYPES.map(t => (
                <button key={t.value} type="button"
                  style={{
                    ...s.typeCard,
                    border: `2px solid ${space.space_type === t.value ? '#3b82f6' : '#1e293b'}`,
                    background: space.space_type === t.value ? '#1e3a5f' : '#0f172a',
                  }}
                  onClick={() => setSpace({ ...space, space_type: t.value })}
                >
                  <span style={{ fontSize: 24 }}>{t.icon}</span>
                  <span style={s.typeLabel}>{t.label}</span>
                  <span style={s.typeDesc}>{t.desc}</span>
                </button>
              ))}
            </div>
            <label style={s.label}>Dirección (opcional)
              <input style={s.input} value={space.direccion}
                onChange={e => setSpace({ ...space, direccion: e.target.value })}
                placeholder="Av. Principal 1234" />
            </label>
            <label style={s.label}>Precio por unidad / mes (en $)
              <input style={s.input} type="number" min="0" value={space.precio}
                onChange={e => setSpace({ ...space, precio: e.target.value })}
                placeholder="0" />
            </label>
            <div style={s.btnRow}>
              <button type="button" style={s.backBtn} onClick={() => setStep('organizacion')}>← Volver</button>
              <button style={s.primaryBtn} type="submit" disabled={loading}>
                {loading ? 'Creando...' : '🚀 Crear espacio'}
              </button>
            </div>
          </form>
        )}

        <p style={s.footerText}>
          ¿Ya tenés cuenta? <a href="/" style={s.link}>Iniciá sesión</a>
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:          { minHeight: '100vh', backgroundColor: '#060d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' },
  card:          { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: '40px 36px', width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' },
  logoRow:       { marginBottom: 24 },
  logo:          { fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  title:         { fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  subtitle:      { fontSize: 14, color: '#64748b', margin: '0 0 28px' },
  progress:      { display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32, position: 'relative' },
  progressStep:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, zIndex: 1 },
  progressDot:   { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' },
  progressLabel: { fontSize: 11, fontWeight: 600 },
  progressLine:  { position: 'absolute', top: 15, left: '16%', right: '16%', height: 2, background: '#1e293b', zIndex: 0 },
  form:          { display: 'flex', flexDirection: 'column', gap: 18 },
  label:         { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  input:         { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none' },
  row:           { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  slugInput:     { fontFamily: 'monospace', letterSpacing: 0.5 },
  slugPreview:   { fontSize: 12, color: '#475569', marginTop: 4 },
  typeGrid:      { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  typeCard:      { borderRadius: 12, padding: '12px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
  typeLabel:     { fontSize: 12, fontWeight: 700, color: '#fff' },
  typeDesc:      { fontSize: 10, color: '#64748b', textAlign: 'center' as const },
  errorBox:      { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  primaryBtn:    { background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, padding: '13px 24px', cursor: 'pointer', flex: 1 },
  backBtn:       { background: 'transparent', border: '1px solid #334155', borderRadius: 12, color: '#94a3b8', fontWeight: 600, fontSize: 15, padding: '13px 20px', cursor: 'pointer' },
  btnRow:        { display: 'flex', gap: 12, marginTop: 4 },
  secondaryBtn:  { flex: 1, textAlign: 'center' as const, background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#94a3b8', fontWeight: 600, fontSize: 14, padding: '12px 0', textDecoration: 'none', cursor: 'pointer' },
  actionRow:     { display: 'flex', gap: 12, marginTop: 8 },
  successIcon:   { fontSize: 56, textAlign: 'center' as const, marginBottom: 12 },
  codeBox:       { background: '#0f172a', border: '2px dashed #334155', borderRadius: 16, padding: '20px 24px', margin: '24px 0', textAlign: 'center' as const },
  codeLabel:     { fontSize: 12, color: '#64748b', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: 1 },
  code:          { fontSize: 36, fontWeight: 800, color: '#3b82f6', letterSpacing: 5, margin: '0 0 6px' },
  codeHint:      { fontSize: 12, color: '#475569', margin: 0 },
  footerText:    { textAlign: 'center' as const, fontSize: 13, color: '#475569', marginTop: 28 },
  link:          { color: '#3b82f6', textDecoration: 'none', fontWeight: 600 },
};
