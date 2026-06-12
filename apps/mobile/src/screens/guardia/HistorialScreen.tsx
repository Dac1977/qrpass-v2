import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { accesosApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

type Ingreso = {
  id: string;
  nombreVisitante: string;
  dniVisitante: string | null;
  casaDestino: string | null;
  tipo: string;
  estado: string;
  createdAt: string;
};

export function HistorialScreen() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { space } = useAuthStore();

  const fetchIngresos = async () => {
    if (!space?.id) return;

    try {
      const data = await accesosApi.historial(space.id, 50);
      setIngresos((data as any)?.accesos || data || []);
    } catch (error) {
      console.error('Error fetching ingresos:', error);
    }
  };

  useEffect(() => {
    fetchIngresos();
  }, [space?.id]);

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
        <Text style={styles.nombre} numberOfLines={1}>{item.nombreVisitante}</Text>
        <Text style={styles.detalle}>
          {item.casaDestino ? `Casa ${item.casaDestino}` : 'Sin destino'} • {item.tipo}
        </Text>
        {item.dniVisitante && (
          <Text style={styles.dni}>DNI: {item.dniVisitante}</Text>
        )}
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
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
