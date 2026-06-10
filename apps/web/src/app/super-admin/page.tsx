'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, saveToken, saveUser, clearToken } from '@/lib/api';
import type { Profile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
  es_titular: boolean;
  titular_id: string | null;
};

type Barrio = {
  id: string;
  nombre: string;
  direccion: string | null;
  precio_por_casa: number | null;
  activo: boolean;
  created_at: string;
  codigo_invitacion?: string | null;
  space_type?: string;
  organization_id?: string | null;
  total_usuarios?: number;
  total_vecinos?: number;
  total_guardias?: number;
  total_admins?: number;
};

type Organization = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  activo: boolean;
  owner_id: string | null;
  created_at: string;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\W_]/g, '')
    .replace(/[\u0300-\u036f]/g, '');

const generateCodigoBarrio = (nombre: string) => {
  const normalized = normalizeText(nombre)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const base = (normalized || 'BARRIO').slice(0, 4).padEnd(4, 'X');

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }

  const suffix = Math.abs(hash % 10000).toString().padStart(4, '0');
  return `${base}${suffix}`;
};

function spaceTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    residential: 'Residencial',
    gym: 'Gimnasio',
    club: 'Club',
    event: 'Evento',
    coworking: 'Coworking',
    other: 'Otro',
  };
  return labels[type ?? ''] ?? 'Residencial';
}

function spaceTypeColor(type?: string): string {
  const colors: Record<string, string> = {
    residential: '#0f766e',
    gym: '#7c3aed',
    club: '#b45309',
    event: '#0369a1',
    coworking: '#be185d',
    other: '#374151',
  };
  return colors[type ?? ''] ?? '#0f766e';
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

export default function SuperAdminPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [roleStatus, setRoleStatus] = useState<'loading' | 'allowed' | 'redirecting' | 'denied'>('loading');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);

  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [barriosLoading, setBarriosLoading] = useState(true);
  const [barriosError, setBarriosError] = useState<string | null>(null);
  const [copiedBarrioId, setCopiedBarrioId] = useState<string | null>(null);

  const [filtroRol, setFiltroRol] = useState<'todos' | 'vecino' | 'guardia' | 'admin' | 'super_admin'>('todos');
  const [filtroBarrio, setFiltroBarrio] = useState('todos');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateBarrio, setShowCreateBarrio] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserRol, setNewUserRol] = useState<'vecino' | 'guardia' | 'admin'>('vecino');
  const [newUserBarrioId, setNewUserBarrioId] = useState('');
  const [newUserNumeroCasa, setNewUserNumeroCasa] = useState('');
  const [newUserTelefono, setNewUserTelefono] = useState('');
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const [newBarrioNombre, setNewBarrioNombre] = useState('');
  const [newBarrioDireccion, setNewBarrioDireccion] = useState('');
  const [newBarrioPrecio, setNewBarrioPrecio] = useState('');
  const [newBarrioCodigo, setNewBarrioCodigo] = useState(generateCodigoBarrio(''));
  const [newBarrioSpaceType, setNewBarrioSpaceType] = useState('residential');
  const [newBarrioOrgId, setNewBarrioOrgId] = useState('');
  const [createBarrioLoading, setCreateBarrioLoading] = useState(false);
  const [createBarrioError, setCreateBarrioError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgNombre, setNewOrgNombre] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgDescripcion, setNewOrgDescripcion] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [createOrgLoading, setCreateOrgLoading] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  const [instagramSessions, setInstagramSessions] = useState<any[]>([]);
  const [igLoading, setIgLoading] = useState(true);
  const [convTab, setConvTab] = useState<'web' | 'instagram'>('web');
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [selectedConvType, setSelectedConvType] = useState<'web' | 'instagram'>('web');
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const { user } = await api.auth.me();
      setProfile({ id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, barrio_id: user.barrioId ?? null, numero_casa: user.numeroCasa ?? null, telefono: user.telefono ?? null });
    } catch {
      clearToken();
      setProfile(null);
    }
  }, []);

  const cargarUsuarios = useCallback(async () => {
    if (profile?.rol !== 'super_admin') return;
    setUsuariosLoading(true);
    setUsuariosError(null);
    try {
      const { users } = await api.users.list();
      setUsuarios(users.map((u: any) => ({
        id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
        barrio_id: u.barrioId ?? null, barrio_nombre: u.space?.nombre ?? null,
        numero_casa: u.numeroCasa ?? null, telefono: u.telefono ?? null,
        created_at: u.createdAt, last_sign_in_at: null, es_titular: true, titular_id: null,
      })));
    } catch {
      setUsuariosError('No pudimos cargar los usuarios');
    }
    setUsuariosLoading(false);
  }, [profile?.rol]);

  const cargarBarrios = useCallback(async () => {
    if (profile?.rol !== 'super_admin') return;
    setBarriosLoading(true);
    setBarriosError(null);
    try {
      const { spaces } = await api.spaces.list();
      setBarrios(spaces.map((s: any) => ({
        id: s.id, nombre: s.nombre, direccion: s.direccion ?? null,
        precio_por_casa: s.precioPorCasa ?? null, activo: s.activo,
        created_at: s.createdAt, codigo_invitacion: s.codigoInvitacion ?? null,
        space_type: s.spaceType ?? 'residential', organization_id: s.organizationId ?? null,
      })));
    } catch {
      setBarriosError('No pudimos cargar los barrios');
    }
    setBarriosLoading(false);
  }, [profile?.rol]);

  const cargarLeads = useCallback(async () => {
    setLeadsLoading(false); // TODO: endpoint de leads/agente-ventas no migrado aún
  }, []);

  const cargarInstagramSessions = useCallback(async () => {
    setIgLoading(false); // TODO: endpoint de Instagram sessions no migrado aún
  }, []);

  const toggleTakeover = async (_type: 'web' | 'instagram', _sessionId: string, _currentValue: boolean) => {
    alert('Gestión de leads pendiente de migración al nuevo backend');
  };

  const eliminarConversacion = async (_type: 'web' | 'instagram', _sessionId: string) => {
    alert('Eliminación de conversaciones pendiente de migración al nuevo backend');
  };

  const sendAdminReply = async () => {
    alert('Envío de respuesta pendiente de migración al nuevo backend');
  };

  const cargarOrganizations = useCallback(async () => {
    if (profile?.rol !== 'super_admin') return;
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const { organizations: orgs } = await api.organizations.list();
      setOrganizations(orgs.map((o: any) => ({
        id: o.id, nombre: o.nombre, slug: o.slug, descripcion: o.descripcion ?? null,
        plan: o.plan ?? 'free', activo: o.activo, owner_id: o.ownerId ?? null, created_at: o.createdAt,
      })));
    } catch {
      setOrgsError('No pudimos cargar las organizaciones');
    }
    setOrgsLoading(false);
  }, [profile?.rol]);

  useEffect(() => {
    const bootstrap = async () => {
      if (getToken()) {
        setRoleStatus('loading');
        await fetchProfile();
      }
      setReady(true);
    };
    bootstrap();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile?.rol) {
      return;
    }

    if (profile.rol === 'super_admin') {
      setRoleStatus('allowed');
      cargarUsuarios();
      cargarBarrios();
      cargarOrganizations();
      cargarLeads();
      cargarInstagramSessions();
      return;
    }

    if (profile.rol === 'admin') {
      setRoleStatus('redirecting');
      router.replace('/admin');
      return;
    }

    if (profile.rol === 'guardia') {
      setRoleStatus('redirecting');
      router.replace('/');
      return;
    }

    setRoleStatus('denied');
  }, [profile?.rol, cargarUsuarios, cargarBarrios, cargarOrganizations, cargarLeads, cargarInstagramSessions, router]);

  const handleLogout = () => {
    clearToken();
    setProfile(null);
    setRoleStatus('loading');
    router.push('/');
  };

  const crearUsuario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateUserLoading(true);
    setCreateUserError(null);

    try {
      const { user: newUser } = await api.auth.register({
        email: newUserEmail,
        password: 'temporal123',
        nombre: newUserNombre,
      });
      await api.users.update(newUser.id, {
        rol: newUserRol,
        barrioId: newUserBarrioId || null,
        numeroCasa: newUserNumeroCasa || null,
        telefono: newUserTelefono || null,
      });
      setShowCreateUser(false);
      setNewUserEmail(''); setNewUserNombre(''); setNewUserRol('vecino');
      setNewUserBarrioId(''); setNewUserNumeroCasa(''); setNewUserTelefono('');
      cargarUsuarios();
    } catch (error) {
      console.error(error);
      setCreateUserError('No pudimos crear el usuario');
    }

    setCreateUserLoading(false);
  };

  const crearBarrio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateBarrioLoading(true);
    setCreateBarrioError(null);

    try {
      if (!newBarrioOrgId) throw new Error('Seleccioná una organización');
      await api.spaces.create({
        nombre: newBarrioNombre,
        organizationId: newBarrioOrgId,
        spaceType: newBarrioSpaceType,
        direccion: newBarrioDireccion || undefined,
        precioPorCasa: newBarrioPrecio ? parseInt(newBarrioPrecio, 10) : undefined,
      });
      setShowCreateBarrio(false);
      setNewBarrioNombre(''); setNewBarrioDireccion(''); setNewBarrioPrecio('');
      setNewBarrioCodigo(generateCodigoBarrio('')); setNewBarrioSpaceType('residential'); setNewBarrioOrgId('');
      cargarBarrios();
    } catch (error: any) {
      console.error(error);
      setCreateBarrioError(error.message || 'No pudimos crear el barrio');
    }

    setCreateBarrioLoading(false);
  };

  const crearOrganizacion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateOrgLoading(true);
    setCreateOrgError(null);

    try {
      const slug = newOrgSlug.trim() ||
        newOrgNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await api.organizations.create({ nombre: newOrgNombre, slug, descripcion: newOrgDescripcion || null });
      setShowCreateOrg(false);
      setNewOrgNombre(''); setNewOrgSlug(''); setNewOrgDescripcion(''); setNewOrgPlan('free');
      cargarOrganizations();
    } catch (error) {
      console.error(error);
      setCreateOrgError('No pudimos crear la organización');
    }

    setCreateOrgLoading(false);
  };

  const copyCodigo = async (codigo?: string | null, barrioId?: string) => {
    if (!codigo || !barrioId) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiedBarrioId(barrioId);
      setTimeout(() => setCopiedBarrioId((current) => (current === barrioId ? null : current)), 2000);
    } catch (error) {
      console.error('copy codigo', error);
    }
  };

  const actualizarRolUsuario = async (userId: string, nuevoRol: string) => {
    try {
      await api.users.update(userId, { rol: nuevoRol });
      cargarUsuarios();
    } catch (error) {
      console.error(error);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const usuario = filtroUsuario.trim().toLowerCase();
    return usuarios.filter((usr) => {
      const coincideUsuario = usuario
        ? (usr.nombre || '').toLowerCase().includes(usuario) ||
          (usr.email || '').toLowerCase().includes(usuario) ||
          (usr.numero_casa || '').toLowerCase().includes(usuario)
        : true;
      const coincideRol = filtroRol === 'todos' || usr.rol === filtroRol;
      const coincideBarrio = filtroBarrio === 'todos' || usr.barrio_id === filtroBarrio;
      return coincideUsuario && coincideRol && coincideBarrio;
    });
  }, [usuarios, filtroUsuario, filtroRol, filtroBarrio]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { token, user } = await api.auth.login({ email: loginEmail, password: loginPassword });
      saveToken(token);
      saveUser(user);
      await fetchProfile();
    } catch {
      setLoginError('Email o contraseña incorrectos');
    }
    setLoginLoading(false);
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
          <h1 style={styles.loginTitle}>🔐 Super Admin QRPass</h1>
          <p style={styles.loginSubtitle}>Ingresá con tu cuenta de super administrador</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <input style={styles.modalInput} type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoFocus />
            <input style={styles.modalInput} type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            {loginError && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{loginError}</p>}
            <button type="submit" style={styles.loginButton} disabled={loginLoading}>
              {loginLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
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

  if (roleStatus === 'denied' && profile?.rol !== 'super_admin') {
    return (
      <div style={styles.fullContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>🚫 Acceso restringido</h1>
          <p style={styles.loginSubtitle}>Solo el Super Admin puede acceder.</p>
          <button style={styles.loginButton} onClick={handleLogout}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.page}>
        <header style={styles.header}>
          <div>
            <p style={styles.headerLabel}>Super Administrador</p>
            <h2 style={styles.headerName}>{profile?.nombre || 'Super Admin'}</h2>
            <p style={styles.headerSub}>Control total de la plataforma</p>
          </div>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </header>

        <main style={styles.content}>
          <section style={{ ...styles.column, gridColumn: '1 / -1' }}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🏢 Organizaciones</h3>
                <span style={styles.cardSub}>Empresas y entidades que usan la plataforma</span>
              </div>
              <div style={styles.filtersRow}>
                <button style={styles.createButton} onClick={() => setShowCreateOrg(true)}>
                  + Nueva Organización
                </button>
              </div>
              <div style={styles.tableCard}>
                {orgsLoading ? (
                  <p style={styles.emptyResults}>Cargando organizaciones...</p>
                ) : orgsError ? (
                  <p style={styles.errorMsg}>{orgsError}</p>
                ) : organizations.length === 0 ? (
                  <p style={styles.emptyResults}>No hay organizaciones creadas aún</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Nombre</th>
                        <th style={styles.th}>Slug</th>
                        <th style={styles.th}>Plan</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Creado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((org) => (
                        <tr key={org.id}>
                          <td style={styles.td}><strong>{org.nombre}</strong></td>
                          <td style={styles.td}><span style={styles.codePill}>{org.slug}</span></td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusPill, backgroundColor: org.plan === 'enterprise' ? '#b45309' : org.plan === 'pro' ? '#7c3aed' : '#0f766e', color: '#fff' }}>
                              {org.plan.toUpperCase()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusPill, backgroundColor: org.activo ? '#22c55e' : '#ef4444' }}>
                              {org.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td style={styles.td}>{new Date(org.created_at).toLocaleDateString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>🏘️ Gestión de Spaces</h3>
                <span style={styles.cardSub}>Barrios, gimnasios, clubes y otros espacios</span>
              </div>

              <div style={styles.filtersRow}>
                <button style={styles.createButton} onClick={() => setShowCreateBarrio(true)}>
                  + Nuevo Space
                </button>
              </div>

              <div style={styles.tableCard}>
                {barriosLoading ? (
                  <p style={styles.emptyResults}>Cargando barrios...</p>
                ) : barriosError ? (
                  <p style={styles.errorMsg}>{barriosError}</p>
                ) : barrios.length === 0 ? (
                  <p style={styles.emptyResults}>No hay barrios creados</p>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Nombre</th>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Dirección</th>
                        <th style={styles.th}>Código</th>
                        <th style={styles.th}>Precio</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Total Usuarios</th>
                        <th style={styles.th}>Vecinos</th>
                        <th style={styles.th}>Guardias</th>
                        <th style={styles.th}>Admins</th>
                        <th style={styles.th}>Creado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barrios.map((barrio) => (
                        <tr key={barrio.id}>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={styles.barrioLink}
                              onClick={() => router.push(`/super-admin/barrios/${barrio.id}`)}
                            >
                              {barrio.nombre}
                            </button>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusPill, backgroundColor: spaceTypeColor(barrio.space_type), color: '#fff' }}>
                              {spaceTypeLabel(barrio.space_type)}
                            </span>
                          </td>
                          <td style={styles.td}>{barrio.direccion || 'Sin dirección'}</td>
                          <td style={styles.td}>
                            <div style={styles.infoRow}>
                              <span style={styles.infoLabel}>Código</span>
                              <div style={styles.codeRow}>
                                <span style={styles.codePill}>{barrio.codigo_invitacion || 'Sin código'}</span>
                                <button
                                  type="button"
                                  style={styles.copyButton}
                                  onClick={() => copyCodigo(barrio.codigo_invitacion, barrio.id)}
                                  disabled={!barrio.codigo_invitacion}
                                >
                                  Copiar
                                </button>
                                {copiedBarrioId === barrio.id && <span style={styles.copyHint}>¡Copiado!</span>}
                              </div>
                            </div>
                          </td>
                          <td style={styles.td}>
                            {barrio.precio_por_casa ? `$${barrio.precio_por_casa}` : 'N/A'}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.statusPill,
                                backgroundColor: barrio.activo ? '#22c55e' : '#ef4444',
                              }}
                            >
                              {barrio.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.userCount}>{barrio.total_usuarios || 0}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.userCount, backgroundColor: '#10b981' }}>
                              {barrio.total_vecinos || 0}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.userCount, backgroundColor: '#3b82f6' }}>
                              {barrio.total_guardias || 0}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.userCount, backgroundColor: '#8b5cf6' }}>
                              {barrio.total_admins || 0}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {new Date(barrio.created_at).toLocaleDateString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          <section style={styles.column}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>👥 Gestión de usuarios</h3>
                <span style={styles.cardSub}>Control global de cuentas</span>
              </div>

              <div style={styles.filtersRow}>
                <label style={styles.filterLabel}>
                  Buscar
                  <input
                    style={styles.filterInput}
                    value={filtroUsuario}
                    onChange={(e) => setFiltroUsuario(e.target.value)}
                    placeholder="Nombre, email o casa"
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
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admins</option>
                    <option value="guardia">Guardias</option>
                    <option value="vecino">Vecinos</option>
                  </select>
                </label>
                <label style={styles.filterLabel}>
                  Barrio
                  <select
                    style={styles.filterInput}
                    value={filtroBarrio}
                    onChange={(e) => setFiltroBarrio(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {barrios.map((barrio) => (
                      <option key={barrio.id} value={barrio.id}>
                        {barrio.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button style={styles.createButton} onClick={() => setShowCreateUser(true)}>
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
                          {(usr.rol ?? 'sin rol').toUpperCase()} • {usr.barrio_nombre || 'Sin barrio'} • Casa {usr.numero_casa || 'N/A'} •{' '}
                          Último acceso:{' '}
                          {usr.last_sign_in_at
                            ? new Date(usr.last_sign_in_at).toLocaleDateString('es-AR')
                            : 'Nunca'}
                        </p>
                      </div>
                      <div style={styles.userActions}>
                        <select
                          style={styles.roleSelect}
                          value={usr.rol ?? ''}
                          onChange={(e) => actualizarRolUsuario(usr.id, e.target.value)}
                          disabled={usr.rol === 'super_admin'}
                        >
                          <option value="vecino">Vecino</option>
                          <option value="guardia">Guardia</option>
                          <option value="admin">Admin</option>
                          {usr.rol === 'super_admin' && <option value="super_admin">Super Admin</option>}
                        </select>
                        <span style={{ ...styles.rolePill, backgroundColor: rolColor(usr.rol) }}>{usr.rol}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>

        {/* LEADS */}
        <div style={{ marginTop: 24 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>🤖 Leads del agente de ventas</h3>
              <span style={styles.cardSub}>{leads.length} contactos capturados</span>
            </div>
            {leadsLoading ? (
              <p style={styles.emptyResults}>Cargando leads...</p>
            ) : leads.length === 0 ? (
              <p style={styles.emptyResults}>No hay leads aún.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>{['Nombre', 'Email', 'Tipo org', 'Estado', 'Takeover', 'Fecha', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <tr key={lead.id}>
                        <td style={styles.td}>{lead.nombre || <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={styles.td}>{lead.email || <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={styles.td}>{lead.tipo_organizacion ? <span style={{ background: spaceTypeColor(lead.tipo_organizacion) + '30', color: spaceTypeColor(lead.tipo_organizacion), borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{spaceTypeLabel(lead.tipo_organizacion)}</span> : <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={styles.td}><span style={{ background: lead.estado === 'nuevo' ? '#17253a' : '#14532d', color: lead.estado === 'nuevo' ? '#38bdf8' : '#4ade80', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{lead.estado}</span></td>
                        <td style={styles.td}><span style={{ background: lead.human_takeover ? '#78350f' : '#14532d', color: lead.human_takeover ? '#fbbf24' : '#4ade80', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{lead.human_takeover ? 'Manual' : 'Bot'}</span></td>
                        <td style={styles.td}>{new Date(lead.created_at).toLocaleDateString('es-AR')}</td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setSelectedConv(lead); setSelectedConvType('web'); }} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Ver</button>
                            <button onClick={() => eliminarConversacion('web', lead.id)} style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: '#7f1d1d', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Instagram sessions */}
        <div style={{ marginTop: 24 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>📷 Conversaciones Instagram</h3>
              <span style={styles.cardSub}>{instagramSessions.length} sesiones</span>
            </div>
            {igLoading ? (
              <p style={styles.emptyResults}>Cargando...</p>
            ) : instagramSessions.length === 0 ? (
              <p style={styles.emptyResults}>No hay conversaciones de Instagram aún.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>{['Nombre', 'Email', 'Tipo org', 'Takeover', 'Última actividad', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {instagramSessions.map(sess => (
                      <tr key={sess.sender_id}>
                        <td style={styles.td}>{sess.nombre || sess.sender_id}</td>
                        <td style={styles.td}>{sess.email || <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={styles.td}>{sess.tipo_org ? <span style={{ background: spaceTypeColor(sess.tipo_org) + '30', color: spaceTypeColor(sess.tipo_org), borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{spaceTypeLabel(sess.tipo_org)}</span> : <span style={{ color: '#475569' }}>—</span>}</td>
                        <td style={styles.td}><span style={{ background: sess.human_takeover ? '#78350f' : '#14532d', color: sess.human_takeover ? '#fbbf24' : '#4ade80', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{sess.human_takeover ? 'Manual' : 'Bot'}</span></td>
                        <td style={styles.td}>{new Date(sess.updated_at).toLocaleString('es-AR')}</td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setSelectedConv(sess); setSelectedConvType('instagram'); }} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Ver</button>
                            <button onClick={() => eliminarConversacion('instagram', sess.sender_id)} style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: '#7f1d1d', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {showCreateUser && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateUser(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Crear nuevo usuario</h3>
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
                Nombre completo
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
                Barrio
                <select
                  style={styles.modalInput}
                  value={newUserBarrioId}
                  onChange={(e) => setNewUserBarrioId(e.target.value)}
                >
                  <option value="">Seleccionar barrio</option>
                  {barrios.map((barrio) => (
                    <option key={barrio.id} value={barrio.id}>
                      {barrio.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.modalLabel}>
                Número de casa (opcional)
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
                <button type="button" style={styles.cancelButton} onClick={() => setShowCreateUser(false)}>
                  Cancelar
                </button>
                <button type="submit" style={styles.createButton} disabled={createUserLoading}>
                  {createUserLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateBarrio && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateBarrio(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Crear nuevo space</h3>
            <form style={styles.modalForm} onSubmit={crearBarrio}>
              <label style={styles.modalLabel}>
                Nombre del barrio
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newBarrioNombre}
                  onChange={(e) => {
                    setNewBarrioNombre(e.target.value);
                    setNewBarrioCodigo(generateCodigoBarrio(e.target.value));
                  }}
                  required
                />
              </label>
              <label style={styles.modalLabel}>
                Dirección (opcional)
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newBarrioDireccion}
                  onChange={(e) => setNewBarrioDireccion(e.target.value)}
                  placeholder="Ej: Calle Falsa 123"
                />
              </label>
              <label style={styles.modalLabel}>
                Precio por casa (opcional)
                <input
                  style={styles.modalInput}
                  type="number"
                  value={newBarrioPrecio}
                  onChange={(e) => setNewBarrioPrecio(e.target.value)}
                  placeholder="Ej: 5000"
                />
              </label>
              <label style={styles.modalLabel}>
                Tipo de espacio
                <select
                  style={styles.modalInput}
                  value={newBarrioSpaceType}
                  onChange={(e) => setNewBarrioSpaceType(e.target.value)}
                >
                  <option value="residential">Residencial (Barrio / Country)</option>
                  <option value="gym">Gimnasio</option>
                  <option value="club">Club</option>
                  <option value="event">Evento</option>
                  <option value="coworking">Coworking</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label style={styles.modalLabel}>
                Organización (opcional)
                <select
                  style={styles.modalInput}
                  value={newBarrioOrgId}
                  onChange={(e) => setNewBarrioOrgId(e.target.value)}
                >
                  <option value="">Sin organización</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.nombre}</option>
                  ))}
                </select>
              </label>
              <label style={styles.modalLabel}>
                Código de invitación (autogenerado)
                <div style={styles.codeRow}>
                  <input
                    style={{ ...styles.modalInput, flex: 1 }}
                    type="text"
                    value={newBarrioCodigo}
                    readOnly
                  />
                  <button
                    type="button"
                    style={styles.codeRefreshButton}
                    onClick={() => setNewBarrioCodigo(generateCodigoBarrio(newBarrioNombre))}
                  >
                    ↻
                  </button>
                </div>
              </label>

              {createBarrioError && <p style={styles.errorMsg}>{createBarrioError}</p>}

              <div style={styles.modalButtons}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowCreateBarrio(false)}>
                  Cancelar
                </button>
                <button type="submit" style={styles.createButton} disabled={createBarrioLoading}>
                  {createBarrioLoading ? 'Creando...' : 'Crear Barrio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateOrg && (
        <div style={styles.modalBackdrop} onClick={() => setShowCreateOrg(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Nueva Organización</h3>
            <form style={styles.modalForm} onSubmit={crearOrganizacion}>
              <label style={styles.modalLabel}>
                Nombre
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newOrgNombre}
                  onChange={(e) => {
                    setNewOrgNombre(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(
                        e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                      );
                    }
                  }}
                  required
                  placeholder="Ej: Club Atlético Buenos Aires"
                />
              </label>
              <label style={styles.modalLabel}>
                Slug (URL amigable)
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  placeholder="Ej: club-atletico-bsas"
                />
              </label>
              <label style={styles.modalLabel}>
                Descripción (opcional)
                <input
                  style={styles.modalInput}
                  type="text"
                  value={newOrgDescripcion}
                  onChange={(e) => setNewOrgDescripcion(e.target.value)}
                  placeholder="Ej: Club deportivo y social en CABA"
                />
              </label>
              <label style={styles.modalLabel}>
                Plan
                <select
                  style={styles.modalInput}
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value as 'free' | 'pro' | 'enterprise')}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              {createOrgError && <p style={styles.errorMsg}>{createOrgError}</p>}
              <div style={styles.modalButtons}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowCreateOrg(false)}>
                  Cancelar
                </button>
                <button type="submit" style={styles.createButton} disabled={createOrgLoading}>
                  {createOrgLoading ? 'Creando...' : 'Crear Organización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal conversación */}
      {selectedConv && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedConv(null)}>
          <div style={{ ...styles.modalCard, maxWidth: 660, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header fijo */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #0f3460', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
              <div>
                <h3 style={{ ...styles.modalTitle, marginBottom: 4, margin: 0 }}>
                  {selectedConvType === 'web' ? (selectedConv.nombre || selectedConv.email || 'Anónimo') : (selectedConv.nombre || selectedConv.sender_id)}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>{selectedConvType === 'web' ? selectedConv.email : `ID: ${selectedConv.sender_id}`}</p>
              </div>
              <button
                onClick={() => toggleTakeover(selectedConvType, selectedConvType === 'web' ? selectedConv.id : selectedConv.sender_id, !!selectedConv.human_takeover)}
                style={{ padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', background: selectedConv.human_takeover ? '#22c55e' : '#f59e0b', color: '#000', flexShrink: 0 }}
              >
                {selectedConv.human_takeover ? '✅ Control manual ON' : '🤖 Tomar control'}
              </button>
            </div>

            {/* Historial — área scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#0b1534' }}>
              {((selectedConvType === 'web' ? selectedConv.chat_history : selectedConv.messages) ?? []).length === 0 ? (
                <p style={{ color: '#475569', textAlign: 'center', margin: 'auto' }}>Sin mensajes</p>
              ) : (
                ((selectedConvType === 'web' ? selectedConv.chat_history : selectedConv.messages) ?? []).map((msg: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                    <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 16px 4px' : '16px 16px 4px 16px', background: msg.role === 'user' ? '#1e293b' : '#1d4ed8', fontSize: 14, lineHeight: 1.5 }}>
                      <p style={{ margin: 0, color: msg.role === 'user' ? '#e2e8f0' : '#fff' }}>{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer fijo — respuesta + cerrar */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #0f3460', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, background: '#11162a' }}>
              {selectedConv.human_takeover ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Escribí tu respuesta..."
                    style={{ flex: 1, borderRadius: 12, border: '1px solid #0f3460', padding: '12px 14px', background: '#0b1534', color: '#fff', resize: 'none', height: 72, fontSize: 14 }}
                  />
                  <button onClick={sendAdminReply} disabled={replySending || !replyText.trim()} style={{ padding: '0 20px', borderRadius: 12, border: 'none', background: replySending ? '#475569' : '#22c55e', color: '#000', fontWeight: 700, cursor: replySending ? 'not-allowed' : 'pointer', fontSize: 14, height: 72 }}>
                    {replySending ? '...' : 'Enviar'}
                  </button>
                </div>
              ) : (
                <p style={{ margin: 0, color: '#475569', fontSize: 13, textAlign: 'center' }}>Tomá el control para responder manualmente</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  onClick={() => eliminarConversacion(selectedConvType, selectedConvType === 'web' ? selectedConv.id : selectedConv.sender_id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#7f1d1d', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  🗑 Eliminar conversación
                </button>
                <button onClick={() => setSelectedConv(null)} style={styles.cancelButton}>Cerrar</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0b1020',
    padding: '32px clamp(16px, 4vw, 64px)',
    color: '#f4f4ff',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflowX: 'hidden',
  },
  fullContainer: {
    minHeight: '100vh',
    backgroundColor: '#0b1020',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 16,
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
  createButton: {
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #dc2626, #ef4444)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '12px 16px',
  },
  tableCard: {
    borderRadius: 24,
    border: '1px solid #0f3460',
    overflowX: 'auto',
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
    verticalAlign: 'middle',
  },
  tr: {
    cursor: 'pointer',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8',
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  codePill: {
    borderRadius: 12,
    padding: '8px 14px',
    backgroundColor: '#0b1534',
    border: '1px solid #0f3460',
    fontFamily: 'monospace',
    color: '#fff',
  },
  copyButton: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  copyHint: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: 600,
  },
  codeRefreshButton: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    background: '#0b1534',
    color: '#fff',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  userCount: {
    borderRadius: 999,
    padding: '4px 10px',
    fontWeight: 600,
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#64748b',
    display: 'inline-flex',
    justifyContent: 'center',
    minWidth: 28,
  },
  barrioLink: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  statusPill: {
    borderRadius: 999,
    padding: '4px 12px',
    fontWeight: 600,
    fontSize: 12,
    color: '#0b1020',
    textTransform: 'uppercase',
  },
  usersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxHeight: 520,
    overflowY: 'auto',
  },
  userRow: {
    borderRadius: 18,
    border: '1px solid #0f3460',
    background: '#0f1a3d',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
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
  rolePill: {
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
    maxWidth: 420,
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
    maxWidth: 520,
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
};
