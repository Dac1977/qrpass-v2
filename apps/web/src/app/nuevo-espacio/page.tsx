'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

const SPACE_TYPES = [
  { value: 'residential', label: 'Barrio Cerrado', icon: '🏘️', desc: 'Residencial con control de acceso' },
  { value: 'gym',         label: 'Gimnasio',        icon: '🏋️', desc: 'Socios y turnos de clase' },
  { value: 'club',        label: 'Club',             icon: '🏊', desc: 'Socios y amenities' },
  { value: 'event',       label: 'Evento',           icon: '🎪', desc: 'Entradas y control de acceso' },
  { value: 'coworking',   label: 'Coworking',        icon: '💼', desc: 'Miembros y escritorios' },
  { value: 'other',       label: 'Otro',             icon: '🏢', desc: 'Espacio genérico' },
];

export default function NuevoEspacioPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ codigo: string; spaceName: string; spaceId: string } | null>(null);

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('residential');
  const [direccion, setDireccion] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/admin?redirect=/nuevo-espacio');
      return;
    }
    api.auth.me().then(({ user }) => {
      setUserId(user.id);
    }).catch(() => {
      router.push('/admin?redirect=/nuevo-espacio');
    }).finally(() => setAuthLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !nombre.trim()) return;
    setError(null);
    setLoading(true);

    try {
      // Obtener o crear una org para el usuario
      let orgId: string;
      const { organizations } = await api.organizations.list();
      if (organizations.length) {
        orgId = organizations[0].id;
      } else {
        const slug = nombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
        const { organization } = await api.organizations.create({ nombre: nombre.trim(), slug });
        orgId = organization.id;
      }

      const { space: newSpace } = await api.spaces.create({
        nombre:         nombre.trim(),
        organizationId: orgId,
        spaceType:      tipo,
        direccion:      direccion.trim() || undefined,
      });

      // Actualizar barrioId activo del usuario
      await api.users.update(userId!, { barrioId: newSpace.id });

      setResultado({ codigo: newSpace.codigoInvitacion, spaceName: nombre.trim(), spaceId: newSpace.id });
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return (
    <div style={s.page}><div style={s.card}><p style={{ color: '#94a3b8', textAlign: 'center' }}>Cargando...</p></div></div>
  );

  if (resultado) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.successIcon}>🎉</div>
        <h1 style={s.title}>¡Espacio creado!</h1>
        <p style={s.subtitle}>
          <strong style={{ color: '#fff' }}>{resultado.spaceName}</strong> está listo.
        </p>
        <div style={s.codeBox}>
          <p style={s.codeLabel}>Código de invitación para tus miembros</p>
          <p style={s.code}>{resultado.codigo}</p>
          <p style={s.codeHint}>Compartilo para que puedan unirse desde la app</p>
        </div>
        <button style={s.primaryBtn} onClick={() => router.push('/admin')}>
          Ir al panel →
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Nuevo espacio</h1>
        <p style={s.subtitle}>Se creará dentro de tu organización actual.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={s.label}>Nombre del espacio</label>
          <input
            style={s.input}
            placeholder='Ej: "Gimnasio Eros"'
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            autoFocus
          />

          <label style={s.label}>Tipo de espacio</label>
          <div style={s.typeGrid}>
            {SPACE_TYPES.map(st => (
              <button
                key={st.value}
                type="button"
                style={{ ...s.typeCard, ...(tipo === st.value ? s.typeCardActive : {}) }}
                onClick={() => setTipo(st.value)}
              >
                <span style={{ fontSize: 28 }}>{st.icon}</span>
                <span style={s.typeLabel}>{st.label}</span>
                <span style={s.typeDesc}>{st.desc}</span>
              </button>
            ))}
          </div>

          <label style={s.label}>Dirección (opcional)</label>
          <input
            style={s.input}
            placeholder="Av. Principal 1234"
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" style={s.secondaryBtn} onClick={() => router.back()}>
              ← Volver
            </button>
            <button type="submit" style={s.primaryBtn} disabled={loading || !nombre.trim()}>
              {loading ? 'Creando...' : 'Crear espacio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { background: '#1e293b', borderRadius: 20, padding: 40, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px #0008' },
  title: { color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { color: '#94a3b8', fontSize: 14, margin: '0 0 24px' },
  errorBox: { background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14 },
  label: { display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 16 },
  input: { width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: 10, padding: '12px 14px', fontSize: 15, boxSizing: 'border-box' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 },
  typeCard: { background: '#0f172a', border: '2px solid #334155', borderRadius: 12, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'border-color .2s' },
  typeCardActive: { borderColor: '#3b82f6', background: '#1e3a5f' },
  typeLabel: { color: '#fff', fontWeight: 700, fontSize: 12 },
  typeDesc: { color: '#64748b', fontSize: 10, textAlign: 'center' },
  primaryBtn: { flex: 1, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  secondaryBtn: { background: '#334155', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  successIcon: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  codeBox: { background: '#0f172a', borderRadius: 14, padding: 20, textAlign: 'center', margin: '20px 0 24px' },
  codeLabel: { color: '#94a3b8', fontSize: 12, margin: '0 0 8px' },
  code: { color: '#3b82f6', fontSize: 32, fontWeight: 800, letterSpacing: 6, margin: '0 0 6px' },
  codeHint: { color: '#475569', fontSize: 12, margin: 0 },
};
