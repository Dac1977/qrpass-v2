import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type Ingreso = {
  id: string;
  nombre_visitante: string;
  dni_visitante: string | null;
  casa_destino: string | null;
  tipo: string;
  estado: string;
  created_at: string;
};

export function HistorialScreen() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { profile } = useAuthStore();

  const fetchIngresos = async () => {
    if (!profile?.barrio_id) return;

    const { data, error } = await supabase
      .from('ingresos')
      .select('*')
      .eq('barrio_id', profile.barrio_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setIngresos(data);
    }
  };

  useEffect(() => {
    fetchIngresos();

    // Suscribirse a nuevos ingresos
    const channel = supabase
      .channel('ingresos_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ingresos',
          filter: `barrio_id=eq.${profile?.barrio_id}`,
        },
        (payload) => {
          setIngresos((prev) => [payload.new as Ingreso, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.barrio_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIngresos();
    setRefreshing(false);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'autorizado': return '#22c55e';
      case 'rechazado': return '#ef4444';
      case 'pendiente': return '#eab308';
      case 'excepcion': return '#3b82f6';
      default: return '#888';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };

  const renderItem = ({ item }: { item: Ingreso }) => (
    <View style={styles.item}>
      <View style={[styles.estadoIndicator, { backgroundColor: getEstadoColor(item.estado) }]} />
      <View style={styles.itemContent}>
        <Text style={styles.nombre} numberOfLines={1}>{item.nombre_visitante}</Text>
        <Text style={styles.detalle}>
          {item.casa_destino ? `Casa ${item.casa_destino}` : 'Sin destino'} • {item.tipo}
        </Text>
        {item.dni_visitante && (
          <Text style={styles.dni}>DNI: {item.dni_visitante}</Text>
        )}
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Historial de Ingresos</Text>
      
      <FlatList
        data={ingresos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay ingresos registrados</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    padding: 24,
    paddingBottom: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  estadoIndicator: {
    width: 4,
  },
  itemContent: {
    flex: 1,
    padding: 16,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detalle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  dni: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  timeContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
});
