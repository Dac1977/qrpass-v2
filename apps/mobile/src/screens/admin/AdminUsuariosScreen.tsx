import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, User, UserRol } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';
import { getSpaceLabels } from '../../utils/spaceLabels';

type UsuarioAdmin = User & { numeroUnidad?: string | null; estadoAprobacion?: string };

export function AdminUsuariosScreen() {
  const { profile, space } = useAuthStore();
  const labels = getSpaceLabels(space?.spaceType);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<'todos' | 'vecino' | 'guardia' | 'admin'>('todos');

  const cargarUsuarios = useCallback(async () => {
    if (!space?.id) return;
    try {
      const { users } = await usersApi.listarSpace(space.id);
      setUsuarios(users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [space?.id]);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const onRefresh = () => { setRefreshing(true); cargarUsuarios(); };

  const usuariosFiltrados = usuarios.filter((u) => {
    const coincideRol = filtroRol === 'todos' || u.rol === filtroRol;
    const texto = busqueda.toLowerCase();
    const coincideBusqueda = !texto ||
      (u.nombre || '').toLowerCase().includes(texto) ||
      (u.email || '').toLowerCase().includes(texto) ||
      (u.numeroCasa || '').toLowerCase().includes(texto);
    return coincideRol && coincideBusqueda;
  });

  const cambiarRol = (userId: string, nombreUsuario: string, rolActual: string) => {
    const roles = ['vecino', 'guardia', 'admin'].filter(r => r !== rolActual);
    Alert.alert(
      'Cambiar rol',
      `Rol actual de ${nombreUsuario}: ${rolActual.toUpperCase()}`,
      [
        ...roles.map(r => ({
          text: `Cambiar a ${r.toUpperCase()}`,
          onPress: async () => {
            try {
              await usersApi.actualizar(userId, { rol: r as UserRol });
              cargarUsuarios();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        })),
        { text: 'Cancelar', style: 'cancel' as const }
      ]
    );
  };

  const eliminarUsuario = (_userId: string, nombre: string) => {
    Alert.alert('No disponible', `La eliminación de ${nombre} no está disponible aún.`);
  };

  const rolColor = (rol: string) => {
    switch (rol) {
      case 'admin': return '#ef4444';
      case 'guardia': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Usuarios" />
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Usuarios" />
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder={`Buscar por nombre, email o ${labels.unit.toLowerCase()}...`}
          placeholderTextColor="#64748b"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
        {(['todos', 'vecino', 'guardia', 'admin'] as const).map((rol) => (
          <TouchableOpacity
            key={rol}
            style={[styles.filterChip, filtroRol === rol && styles.filterChipActive]}
            onPress={() => setFiltroRol(rol)}
          >
            <Text style={[styles.filterChipText, filtroRol === rol && styles.filterChipTextActive]}>
              {rol === 'todos' ? 'Todos' : rol === 'vecino' ? labels.members : rol === 'guardia' ? labels.staff : 'Admins'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>{usuariosFiltrados.length} usuarios</Text>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {usuariosFiltrados.map((usr) => (
          <View key={usr.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName} numberOfLines={1}>{usr.nombre || 'Sin nombre'}</Text>
                <View style={[styles.rolBadge, { backgroundColor: rolColor(usr.rol) }]}>
                  <Text style={styles.rolBadgeText}>{usr.rol.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>{usr.email}</Text>
              <Text style={styles.userMeta} numberOfLines={1}>
                {usr.numeroCasa ? `${labels.unit} ${usr.numeroCasa}` : `Sin ${labels.unit.toLowerCase()}`} • 
                {usr.telefono ? ` Tel: ${usr.telefono}` : ' Sin teléfono'}
              </Text>
              <Text style={styles.userDate}>
                Registrado: {new Date(usr.createdAt).toLocaleDateString('es-AR')}
              </Text>
            </View>
            <View style={styles.userActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => cambiarRol(usr.id, usr.nombre || 'usuario', usr.rol)}>
                <Ionicons name="swap-horizontal" size={18} color="#3b82f6" />
              </TouchableOpacity>
              {usr.id !== profile?.id && (
                <TouchableOpacity style={styles.actionBtnDanger} onPress={() => eliminarUsuario(usr.id, usr.nombre || 'usuario')}>
                  <Ionicons name="trash" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  filtersScroll: { maxHeight: 48, marginTop: 10 },
  filtersContainer: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  resultCount: { color: '#64748b', fontSize: 12, marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
  list: { padding: 16, paddingTop: 4 },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
  rolBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  rolBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  userEmail: { fontSize: 13, color: '#94a3b8' },
  userMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  userDate: { fontSize: 11, color: '#475569', marginTop: 2 },
  userActions: { justifyContent: 'center', gap: 8, marginLeft: 10 },
  actionBtn: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
