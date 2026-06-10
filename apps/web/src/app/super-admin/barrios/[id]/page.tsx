'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getToken, clearToken } from '@/lib/api';
import type { Profile } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';

type Barrio = {
  id: string;
  nombre: string;
  direccion: string | null;
  precio_por_casa: number | null;
  activo: boolean;
  habilitar_reconocimiento_facial?: boolean;
  created_at: string;
  codigo_invitacion?: string | null;
  total_usuarios?: number;
  total_vecinos?: number;
  total_guardias?: number;
  total_admins?: number;
};

type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  rol: 'vecino' | 'guardia' | 'admin' | 'super_admin';
  barrio_id: string | null;
  barrio_nombre: string | null;
  numero_casa: string | null;
  telefono: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function BarrioDetail() {
  const router = useRouter();
  const params = useParams();
  const barrioId = params.id as string;
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const [roleStatus, setRoleStatus] = useState<'loading' | 'allowed' | 'redirecting' | 'denied'>('loading');

  const [barrio, setBarrio] = useState<Barrio | null>(null);
  const [barrioLoading, setBarrioLoading] = useState(true);
  const [barrioError, setBarrioError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: '',
    direccion: '',
    precio_por_casa: '',
    activo: true,
    habilitar_reconocimiento_facial: false,
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserRol, setNewUserRol] = useState<'vecino' | 'guardia' | 'admin'>('vecino');
  const [newUserNumeroCasa, setNewUserNumeroCasa] = useState('');
  const [newUserTelefono, setNewUserTelefono] = useState('');
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const { user } = await api.auth.me();
      setProfile({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, barrio_id: user.barrioId ?? null, numero_casa: user.numeroCasa ?? null, telefono: user.telefono ?? null });
    } catch {
      clearToken();
      setProfile(null);
    }
  };

  const cargarBarrio = useCallback(async () => {
    if (!barrioId) return;
    setBarrioLoading(true);
    setBarrioError(null);

    const { data, error } = await api.spaces.get(barrioId).then(({ space }) => ({
      data: [{ id: space.id, nombre: space.nombre, direccion: space.direccion ?? null, precio_por_casa: space.precioPorCasa ?? null, activo: space.activo, created_at: space.createdAt, codigo_invitacion: space.codigoInvitacion ?? null }] as Barrio[],
      error: null as null,
    })).catch((e: any) => ({ data: null, error: e }));

    if (error) {
      console.error(error);
      setBarrioError('No pudimos cargar el barrio');
    } else {
      const barrioData = (data as Barrio[])[0];
      setBarrio(barrioData);
      setEditForm({
        nombre: barrioData.nombre || '',
        direccion: barrioData.direccion || '',
        precio_por_casa: barrioData.precio_por_casa?.toString() || '',
        activo: barrioData.activo,
        habilitar_reconocimiento_facial: barrioData.habilitar_reconocimiento_facial || false,
      });
    }

    setBarrioLoading(false);
  }, [barrioId]);

  const copyCodigo = async (codigo?: string | null) => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiedCode(codigo);
      setTimeout(() => setCopiedCode((current) => (current === codigo ? null : current)), 2000);
    } catch (error) {
      console.error('copy codigo', error);
    }
  };

  const cargarUsuarios = useCallback(async () => {
    if (!barrioId) return;
    setUsuariosLoading(true);
    setUsuariosError(null);

    const { data, error } = await api.spaces.members(barrioId).then(({ members }) => ({
      data: members.map((m: any) => ({
        id: m.user.id, email: m.user.email, nombre: m.user.nombre, rol: m.rol,
        barrio_id: barrioId, barrio_nombre: null,
        numero_casa: m.user.numeroCasa ?? null, telefono: m.user.telefono ?? null,
        created_at: m.createdAt, last_sign_in_at: null,
      })) as Usuario[],
      error: null as null,
    })).catch((e: any) => ({ data: null, error: e }));

    if (error) {
      console.error(error);
      setUsuariosError('No pudimos cargar los usuarios');
    } else {
      setUsuarios((data as Usuario[]) ?? []);
    }

    setUsuariosLoading(false);
  }, [barrioId]);

  useEffect(() => {
    const bootstrap = async () => {
      if (getToken()) {
        setRoleStatus('loading');
        await fetchProfile();
      }
      setReady(true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready || !profile?.rol) return;

    if (profile.rol === 'super_admin') {
      setRoleStatus('allowed');
    } else if (profile.rol === 'admin') {
      setRoleStatus('redirecting');
      router.push('/admin');
    } else if (profile.rol === 'guardia') {
      setRoleStatus('redirecting');
      router.push('/');
    } else {
      setRoleStatus('denied');
      router.push('/');
    }
  }, [ready, profile?.rol, router]);

  useEffect(() => {
    if (roleStatus === 'allowed' && barrioId) {
      cargarBarrio();
      cargarUsuarios();
    }
  }, [roleStatus, barrioId, cargarBarrio, cargarUsuarios]);

  if (!ready || roleStatus === 'loading') {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Verificando acceso...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.fullContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>� Sesión requerida</h1>
          <p style={styles.loginSubtitle}>Iniciá sesión desde la pantalla principal para continuar.</p>
          <button style={styles.loginButton} onClick={() => router.push('/')}>Ir al login</button>
        </div>
      </div>
    );
  }

  if (roleStatus === 'redirecting') {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Redirigiendo...</p>
      </div>
    );
  }

  if (roleStatus === 'denied') {
    return (
      <div style={styles.fullContainer}>
        <p style={{ color: '#fff' }}>Acceso restringido</p>
      </div>
    );
  }

  const actualizarBarrio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUpdateLoading(true);
    setUpdateError(null);

    try {
      await api.spaces.update(barrioId, {
        nombre: editForm.nombre,
        direccion: editForm.direccion || undefined,
        precioPorCasa: editForm.precio_por_casa ? parseInt(editForm.precio_por_casa) : undefined,
        activo: editForm.activo,
      });
      setEditMode(false);
      cargarBarrio();
    } catch (error) {
      console.error(error);
      setUpdateError('No pudimos actualizar el barrio');
    }

    setUpdateLoading(false);
  };

  const crearUsuario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError(null);

    try {
      const { user: newUser } = await api.auth.register({ email: newUserEmail, password: 'temporal123', nombre: newUserNombre });
      await api.users.update(newUser.id, { rol: newUserRol, barrioId, numeroCasa: newUserNumeroCasa || null, telefono: newUserTelefono || null });
      setShowCreateUser(false);
      setNewUserEmail(''); setNewUserNombre(''); setNewUserRol('vecino'); setNewUserNumeroCasa(''); setNewUserTelefono('');
      cargarUsuarios();
      cargarBarrio();
    } catch (error) {
      console.error(error);
      setCreateUserError('No pudimos crear el usuario');
    }

    setCreateUserLoading(false);
  };

  const actualizarRolUsuario = async (userId: string, nuevoRol: string) => {
    try {
      await api.users.update(userId, { rol: nuevoRol });
      cargarUsuarios();
      cargarBarrio();
    } catch (error) {
      console.error(error);
    }
  };

  const eliminarUsuario = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) return;
    try {
      await api.users.delete(userId);
      cargarUsuarios();
      cargarBarrio();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <button style={styles.backButton} onClick={() => router.push('/super-admin')}>
              ← Volver a Barrios
            </button>
            <div>
              <p style={styles.headerLabel}>Detalle del Barrio</p>
              <h2 style={styles.headerName}>{barrio?.nombre || 'Cargando...'}</h2>
              <p style={styles.headerSub}>Gestión completa del barrio</p>
            </div>
          </div>
          <button style={styles.logoutButton} onClick={() => { clearToken(); setProfile(null); }}>
            Cerrar sesión
          </button>
        </header>

        <main style={styles.content}>
          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🏘️ Información del Barrio</h3>
                <span style={styles.cardSub}>Datos generales y configuración</span>
              </div>
              
              {barrioLoading ? (
                <p style={styles.emptyResults}>Cargando barrio...</p>
              ) : barrioError ? (
                <p style={styles.errorMsg}>{barrioError}</p>
              ) : barrio ? (
                <>
                  {editMode ? (
                    <form style={styles.editForm} onSubmit={actualizarBarrio}>
                      <label style={styles.formLabel}>
                        Nombre del Barrio
                        <input
                          style={styles.formInput}
                          type="text"
                          value={editForm.nombre}
                          onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                          required
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Dirección
                        <input
                          style={styles.formInput}
                          type="text"
                          value={editForm.direccion}
                          onChange={(e) => setEditForm({...editForm, direccion: e.target.value})}
                          placeholder="Ej: Calle Falsa 123"
                        />
                      </label>
                      <label style={styles.formLabel}>
                        Precio por Casa
                        <input
                          style={styles.formInput}
                          type="number"
                          value={editForm.precio_por_casa}
                          onChange={(e) => setEditForm({...editForm, precio_por_casa: e.target.value})}
                          placeholder="Ej: 5000"
                        />
                      </label>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={editForm.activo}
                          onChange={(e) => setEditForm({...editForm, activo: e.target.checked})}
                        />
                        Barrio Activo
                      </label>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={editForm.habilitar_reconocimiento_facial}
                          onChange={(e) => setEditForm({...editForm, habilitar_reconocimiento_facial: e.target.checked})}
                        />
                        Habilitar Reconocimiento Facial (Pago)
                      </label>

                      {updateError && <p style={styles.errorMsg}>{updateError}</p>}

                      <div style={styles.formButtons}>
                        <button 
                          style={styles.cancelButton} 
                          type="button" 
                          onClick={() => setEditMode(false)}
                        >
                          Cancelar
                        </button>
                        <button style={styles.saveButton} type="submit" disabled={updateLoading}>
                          {updateLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={styles.infoDisplay}>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Nombre:</span>
                        <span style={styles.infoValue}>{barrio.nombre}</span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Dirección:</span>
                        <span style={styles.infoValue}>{barrio.direccion || 'Sin dirección'}</span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Precio por Casa:</span>
                        <span style={styles.infoValue}>
                          {barrio.precio_por_casa ? `$${barrio.precio_por_casa}` : 'N/A'}
                        </span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Estado:</span>
                        <span style={{ 
                          ...styles.statusPill, 
                          backgroundColor: barrio.activo ? '#22c55e' : '#ef4444' 
                        }}>
                          {barrio.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Código de invitación:</span>
                        <div style={styles.codeRow}>
                          <span style={styles.codePill}>{barrio.codigo_invitacion || 'Sin código'}</span>
                          <button
                            style={styles.copyButton}
                            type="button"
                            onClick={() => copyCodigo(barrio.codigo_invitacion)}
                            disabled={!barrio.codigo_invitacion}
                          >
                            Copiar
                          </button>
                          {copiedCode === barrio.codigo_invitacion && (
                            <span style={styles.copyHint}>¡Copiado!</span>
                          )}
                        </div>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Creado:</span>
                        <span style={styles.infoValue}>
                          {new Date(barrio.created_at).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      <button style={styles.editButton} onClick={() => setEditMode(true)}>
                        ✏️ Editar Información
                      </button>
                    </div>
                  )}

                  <div style={styles.statsRow}>
                    <div style={styles.statCard}>
                      <p style={styles.statNumber}>{barrio.total_usuarios || 0}</p>
                      <p style={styles.statLabel}>Total Usuarios</p>
                    </div>
                    <div style={styles.statCard}>
                      <p style={styles.statNumber}>{barrio.total_vecinos || 0}</p>
                      <p style={styles.statLabel}>Vecinos</p>
                    </div>
                    <div style={styles.statCard}>
                      <p style={styles.statNumber}>{barrio.total_guardias || 0}</p>
                      <p style={styles.statLabel}>Guardias</p>
                    </div>
                    <div style={styles.statCard}>
                      <p style={styles.statNumber}>{barrio.total_admins || 0}</p>
                      <p style={styles.statLabel}>Admins</p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>👥 Usuarios del Barrio</h3>
                <span style={styles.cardSub}>Gestionar usuarios de este barrio</span>
              </div>
              
              <div style={styles.filtersRow}>
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
                ) : usuarios.length === 0 ? (
                  <p style={styles.emptyResults}>No hay usuarios en este barrio</p>
                ) : (
                  usuarios.map((usr) => (
                    <div key={usr.id} style={styles.userRow}>
                      <div>
                        <p style={styles.userNombre}>{usr.nombre || 'Sin nombre'}</p>
                        <p style={styles.userEmail}>{usr.email}</p>
                        <p style={styles.userMeta}>
                          {usr.rol.toUpperCase()} • Casa {usr.numero_casa || 'N/A'} • 
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
                          <option value="vecino">Vecino</option>
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
        </main>
      </div>

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
                  <option value="vecino">Vecino</option>
                  <option value="guardia">Guardia</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label style={styles.modalLabel}>
                Número de Casa (opcional)
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
    </>
  );
}

function rolColor(rol: string | null): string {
  switch (rol) {
    case 'super_admin':
      return '#dc2626';
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
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  backButton: {
    border: '1px solid #64748b',
    color: '#94a3b8',
    background: 'transparent',
    borderRadius: 12,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
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
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
  },
  column: {
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
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 13,
  },
  infoDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #0f3460',
  },
  infoLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 600,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
  },
  codePill: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid #4c1d95',
    backgroundColor: '#2e1065',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  copyButton: {
    borderRadius: 999,
    border: '1px solid #0f3460',
    background: '#0f3460',
    color: '#fff',
    padding: '6px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  copyHint: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: 600,
  },
  editButton: {
    borderRadius: 14,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
    marginTop: 16,
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: '#94a3b8',
  },
  formInput: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    padding: '12px 14px',
    background: '#0b1534',
    color: '#fff',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#94a3b8',
    cursor: 'pointer',
  },
  formButtons: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #22c55e, #34d399)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
    flex: 1,
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
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginTop: 24,
  },
  statCard: {
    background: '#0f1b3a',
    padding: 16,
    borderRadius: 16,
    textAlign: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  filtersRow: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  createButton: {
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #dc2626, #ef4444)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
  },
  usersList: {
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
  loginButton: {
    borderRadius: 16,
    border: 'none',
    padding: '14px 18px',
    background: 'linear-gradient(120deg, #dc2626, #ef4444)',
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
};
