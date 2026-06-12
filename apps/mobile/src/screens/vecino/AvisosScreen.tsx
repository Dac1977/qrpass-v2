import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avisosApi, Aviso } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';


export function AvisosScreen({ navigation }: any) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { space } = useAuthStore();

  const fetchAvisos = async () => {
    if (!space?.id) return;
    try {
      const { avisos: data } = await avisosApi.listar(space.id);
      setAvisos(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAvisos();
    }, [space?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvisos();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Hace un momento';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  const renderAviso = ({ item }: { item: Aviso }) => (
    <TouchableOpacity
      style={[styles.avisoCard, item.importante && styles.avisoFijado]}
      onPress={() => navigation.navigate('DetalleAviso', { aviso: item })}
    >
      <View style={styles.avisoHeader}>
        {item.importante && (
          <View style={[styles.categoriaTag, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="alert-circle-outline" size={12} color="#fff" />
            <Text style={styles.categoriaText}>IMPORTANTE</Text>
          </View>
        )}
        {item.importante && <Ionicons name="pin" size={16} color="#f97316" />}
      </View>

      <Text style={styles.avisoTitulo}>{item.titulo}</Text>
      <Text style={styles.avisoContenido} numberOfLines={2}>
        {item.contenido}
      </Text>

      <View style={styles.avisoFooter}>
        <Text style={styles.autorText} />
        <Text style={styles.fechaText}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={avisos}
        renderItem={renderAviso}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={56} color="#334155" />
              <Text style={styles.emptyText}>No hay avisos todavía</Text>
              <Text style={styles.emptySubtext}>Sé el primero en publicar algo</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CrearAviso')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  avisoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avisoFijado: {
    borderColor: '#f97316',
    borderWidth: 2,
  },
  avisoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  categoriaText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  avisoTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  avisoContenido: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  avisoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  autorText: {
    fontSize: 12,
    color: '#64748b',
  },
  fechaText: {
    fontSize: 12,
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
