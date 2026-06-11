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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';

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

export function AdminIngresosScreen() {
  const { profile } = useAuthStore();
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroCasa, setFiltroCasa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'invitacion' | 'evento' | 'delivery' | 'presentes'>('todos');
  const [registrarSalidas, setRegistrarSalidas] = useState(false);

  const cargarIngresos = useCallback(async () => {
    if (!profile?.barrio_id) return;
    try {
      const inicioDia = new Date();
      inicioDia.setDate(inicioDia.getDate() - 7);
      inicioDia.setHours(0, 0, 0, 0);

      const { data: barrioData } = await supabase
        .from('barrios').select('registrar_salidas').eq('id', profile.barrio_id).single();
      if (barrioData) setRegistrarSalidas(barrioData.registrar_salidas || false);

      const { data, error } = await supabase
        .from('ingresos')
        .select('id, created_at, salida_at, nombre_visitante, dni_visitante, casa_destino, tipo, estado')
        .eq('barrio_id', profile.barrio_id)
        .gte('created_at', inicioDia.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIngresos((data as Ingreso[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.barrio_id]);

  useEffect(() => { cargarIngresos(); }, [cargarIngresos]);

  const onRefresh = () => { setRefreshing(true); cargarIngresos(); };

  const ingresosFiltrados = ingresos.filter((ing) => {
    const casa = filtroCasa.trim().toLowerCase();
    const coincideCasa = !casa || (ing.casa_destino || '').toLowerCase().includes(casa);
    if (filtroTipo === 'presentes') return coincideCasa && ing.estado === 'autorizado' && !ing.salida_at;
    const coincideTipo = filtroTipo === 'todos' || ing.tipo === filtroTipo;
    return coincideCasa && coincideTipo;
  });

  const marcarSalida = (ing: Ingreso) => {
    Alert.alert(
      'Registrar salida',
      `¿Confirmás la salida de ${ing.nombre_visitante || 'esta persona'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            await supabase.from('ingresos').update({ salida_at: new Date().toISOString() }).eq('id', ing.id);
            setIngresos(prev => prev.map(i => i.id === ing.id ? { ...i, salida_at: new Date().toISOString() } : i));
          }
        },
      ]
    );
  };

  const estadoColor = (estado: string | null) => {
    switch (estado) {
      case 'aprobado': return '#22c55e';
      case 'rechazado': return '#ef4444';
      case 'pendiente': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const tipoIcon = (tipo: string | null) => {
    switch (tipo) {
      case 'invitacion': return 'mail';
      case 'evento': return 'calendar';
      case 'delivery': return 'bicycle';
      default: return 'enter';
    }
  };

  const formatFecha = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };

  const formatHora = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Ingresos" />
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Ingresos" />

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filtrar por casa..."
          placeholderTextColor="#64748b"
          value={filtroCasa}
          onChangeText={setFiltroCasa}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
        {(registrarSalidas
          ? ['todos', 'presentes', 'invitacion', 'evento', 'delivery']
          : ['todos', 'invitacion', 'evento', 'delivery']
        ).map((tipo) => (
          <TouchableOpacity
            key={tipo}
            style={[styles.filterChip, filtroTipo === tipo && styles.filterChipActive]}
            onPress={() => setFiltroTipo(tipo as typeof filtroTipo)}
          >
            <Text style={[styles.filterChipText, filtroTipo === tipo && styles.filterChipTextActive]}>
              {tipo === 'todos' ? 'Todos' : tipo === 'presentes' ? '🟢 Adentro' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>
        {ingresosFiltrados.length} ingresos (últimos 7 días)
      </Text>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {ingresosFiltrados.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={40} color="#475569" />
            <Text style={styles.emptyText}>No hay registros para estos filtros</Text>
          </View>
        ) : (
          ingresosFiltrados.map((ing) => {
            const estaAdentro = registrarSalidas && ing.estado === 'autorizado' && !ing.salida_at;
            return (
              <View key={ing.id} style={[styles.ingresoCard, estaAdentro && styles.ingresoCardAdentro]}>
                <View style={[styles.iconCircle, { backgroundColor: `${estadoColor(ing.estado)}20` }]}>
                  <Ionicons name={tipoIcon(ing.tipo) as any} size={20} color={estadoColor(ing.estado)} />
                </View>
                <View style={styles.ingresoInfo}>
                  <Text style={styles.ingresoNombre} numberOfLines={1}>
                    {ing.nombre_visitante || 'Sin nombre'}
                  </Text>
                  <Text style={styles.ingresoMeta} numberOfLines={1}>
                    {ing.dni_visitante ? `DNI: ${ing.dni_visitante} • ` : ''}Casa {ing.casa_destino || 'N/A'}
                  </Text>
                  <View style={styles.ingresoFooter}>
                    <Text style={styles.ingresoFecha}>{formatFecha(ing.created_at)} {formatHora(ing.created_at)}</Text>
                    {ing.salida_at
                      ? <Text style={styles.salidaText}>Salida {formatHora(ing.salida_at)}</Text>
                      : <View style={[styles.estadoPill, { backgroundColor: `${estadoColor(ing.estado)}20` }]}>
                          <Text style={[styles.estadoText, { color: estadoColor(ing.estado) }]}>
                            {(ing.estado || 'N/A').toUpperCase()}
                          </Text>
                        </View>
                    }
                  </View>
                  {estaAdentro && (
                    <TouchableOpacity style={styles.salidaBtn} onPress={() => marcarSalida(ing)}>
                      <Ionicons name="exit-outline" size={14} color="#e94560" />
                      <Text style={styles.salidaBtnText}>Registrar salida</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
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
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  ingresoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  ingresoCardAdentro: { borderWidth: 1, borderColor: '#22c55e33', backgroundColor: '#0f2a1a' },
  salidaText: { fontSize: 11, color: '#64748b' },
  salidaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  salidaBtnText: { fontSize: 12, color: '#e94560', fontWeight: '600' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingresoInfo: { flex: 1 },
  ingresoNombre: { fontSize: 15, fontWeight: '600', color: '#fff' },
  ingresoMeta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  ingresoFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  ingresoFecha: { fontSize: 12, color: '#64748b' },
  estadoPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  estadoText: { fontSize: 10, fontWeight: '700' },
});
