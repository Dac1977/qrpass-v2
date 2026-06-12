import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { usersApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';
import { getSpaceLabels, getSpaceTypeLabel } from '../../utils/spaceLabels';

type Stats = {
  totalUsuarios: number;
  totalVecinos: number;
  totalGuardias: number;
  ingresosHoy: number;
  presentesAhora: number;
  solicitudesPendientes: number;
};

export function AdminDashboardScreen() {
  const { profile, space } = useAuthStore();
  const labels = getSpaceLabels(space?.spaceType);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsuarios: 0, totalVecinos: 0, totalGuardias: 0, ingresosHoy: 0, presentesAhora: 0, solicitudesPendientes: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [registrarSalidas] = useState(false);

  const copiarCodigo = async () => {
    if (!space?.codigoInvitacion) return;
    await Clipboard.setStringAsync(space.codigoInvitacion);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const cargarDatos = useCallback(async () => {
    if (!space?.id) return;

    try {
      const [{ users: allUsers }, { users: pendientes }] = await Promise.all([
        usersApi.listarSpace(space.id),
        usersApi.listarSpace(space.id, { estado: 'pendiente' }),
      ]);

      setSolicitudes(pendientes);
      setStats({
        totalUsuarios: allUsers.length,
        totalVecinos: allUsers.filter(u => u.rol === 'vecino').length,
        totalGuardias: allUsers.filter(u => u.rol === 'guardia').length,
        ingresosHoy: 0,
        presentesAhora: 0,
        solicitudesPendientes: pendientes.length,
      });
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [space?.id]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const onRefresh = () => { setRefreshing(true); cargarDatos(); };

  const aprobarUsuario = async (id: string) => {
    if (!space?.id) return;
    try {
      await usersApi.aprobar(id, space.id);
      Alert.alert('Aprobado', 'El usuario fue aprobado correctamente');
      cargarDatos();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo aprobar');
    }
  };

  const rechazarUsuario = async (id: string) => {
    Alert.alert('Rechazar', '¿Estás seguro de rechazar esta solicitud?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar', style: 'destructive', onPress: async () => {
          if (!space?.id) return;
          try {
            await usersApi.rechazar(id, space.id);
            cargarDatos();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo rechazar');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Panel Admin" />
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Panel Admin" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barrioName}>{space?.nombre}</Text>
            <View style={styles.spaceTypeBadgeRow}>
              <Text style={styles.spaceTypeIcon}>{labels.spaceIcon}</Text>
              <Text style={styles.spaceTypeBadge}>{getSpaceTypeLabel(space?.spaceType)}</Text>
            </View>
          </View>
          {space?.codigoInvitacion && (
            <TouchableOpacity style={styles.copyCodeBtn} onPress={copiarCodigo}>
              <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={copiado ? '#22c55e' : '#94a3b8'} />
              <Text style={[styles.copyCodeText, copiado && { color: '#22c55e' }]}>
                {copiado ? '¡Copiado!' : space.codigoInvitacion}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.welcomeText}>Panel de administración</Text>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
            <Ionicons name="people" size={24} color="#3b82f6" />
            <Text style={styles.statNumber}>{stats.totalUsuarios}</Text>
            <Text style={styles.statLabel}>Usuarios</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#22c55e' }]}>
            <Ionicons name="home" size={24} color="#22c55e" />
            <Text style={styles.statNumber}>{stats.totalVecinos}</Text>
            <Text style={styles.statLabel}>{labels.members}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Ionicons name="shield" size={24} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats.totalGuardias}</Text>
            <Text style={styles.statLabel}>{labels.staff}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#8b5cf6' }]}>
            <Ionicons name="enter" size={24} color="#8b5cf6" />
            <Text style={styles.statNumber}>{stats.ingresosHoy}</Text>
            <Text style={styles.statLabel}>Ingresos hoy</Text>
          </View>
          {registrarSalidas && (
            <View style={[styles.statCard, { borderLeftColor: '#e94560' }]}>
              <Ionicons name="people-circle" size={24} color="#e94560" />
              <Text style={styles.statNumber}>{stats.presentesAhora}</Text>
              <Text style={styles.statLabel}>Presentes ahora</Text>
            </View>
          )}
        </View>

        {/* Solicitudes Pendientes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⏳ Solicitudes Pendientes</Text>
            {stats.solicitudesPendientes > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{stats.solicitudesPendientes}</Text>
              </View>
            )}
          </View>

          {solicitudes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
              <Text style={styles.emptyText}>No hay solicitudes pendientes</Text>
            </View>
          ) : (
            solicitudes.map((sol) => (
              <View key={sol.id} style={styles.solicitudCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.solNombre}>{sol.nombre || 'Sin nombre'}</Text>
                  <Text style={styles.solEmail}>{sol.email}</Text>
                  <Text style={styles.solMeta}>
                    {labels.unit} {sol.numeroCasa || 'N/A'} {sol.telefono ? `• Tel: ${sol.telefono}` : ''}
                  </Text>
                  <Text style={styles.solFecha}>
                    Solicitado: {new Date(sol.createdAt).toLocaleDateString('es-AR')}
                  </Text>
                </View>
                <View style={styles.solActions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => aprobarUsuario(sol.id)}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rechazarUsuario(sol.id)}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  barrioName: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  spaceTypeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 },
  spaceTypeIcon: { fontSize: 14 },
  spaceTypeBadge: { fontSize: 12, color: '#94a3b8', backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  copyCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  copyCodeText: { fontSize: 13, color: '#94a3b8', fontWeight: '600', fontFamily: 'monospace' },
  welcomeText: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#94a3b8' },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  solicitudCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  solNombre: { fontSize: 16, fontWeight: '600', color: '#fff' },
  solEmail: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  solMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  solFecha: { fontSize: 11, color: '#475569', marginTop: 2 },
  solActions: { justifyContent: 'center', gap: 8 },
  approveBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
