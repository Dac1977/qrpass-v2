import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';

type Aviso = {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  fijado: boolean;
  created_at: string;
  autor: {
    nombre: string;
    numero_casa: string | null;
  };
};

const categoriaIconos: Record<string, keyof typeof Ionicons.glyphMap> = {
  general: 'megaphone-outline',
  urgente: 'alert-circle-outline',
  evento: 'calendar-outline',
  perdido: 'search-outline',
  venta: 'pricetag-outline',
  servicio: 'construct-outline',
};

const categoriaColores: Record<string, string> = {
  general: '#3b82f6',
  urgente: '#ef4444',
  evento: '#8b5cf6',
  perdido: '#f59e0b',
  venta: '#22c55e',
  servicio: '#06b6d4',
};

export function AvisosScreen({ navigation }: any) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { profile } = useAuthStore();

  const fetchAvisos = async () => {
    if (!profile?.barrio_id) return;

    const { data, error } = await supabase
      .from('avisos')
      .select(`
        id,
        titulo,
        contenido,
        categoria,
        fijado,
        created_at,
        autor:profiles!autor_id(nombre, numero_casa)
      `)
      .eq('barrio_id', profile.barrio_id)
      .eq('activo', true)
      .order('fijado', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAvisos(data as unknown as Aviso[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchAvisos();
    }, [profile?.barrio_id])
  );

  useEffect(() => {
    if (!profile?.barrio_id) return;

    const channel = supabase
      .channel('avisos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avisos',
          filter: `barrio_id=eq.${profile.barrio_id}`,
        },
        () => {
          fetchAvisos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.barrio_id]);

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
      style={[styles.avisoCard, item.fijado && styles.avisoFijado]}
      onPress={() => navigation.navigate('DetalleAviso', { aviso: item })}
    >
      <View style={styles.avisoHeader}>
        <View style={[styles.categoriaTag, { backgroundColor: categoriaColores[item.categoria] }]}>
          <Ionicons name={categoriaIconos[item.categoria] as any} size={12} color="#fff" />
          <Text style={styles.categoriaText}>{item.categoria.toUpperCase()}</Text>
        </View>
        {item.fijado && <Ionicons name="pin" size={16} color="#f97316" />}
      </View>

      <Text style={styles.avisoTitulo}>{item.titulo}</Text>
      <Text style={styles.avisoContenido} numberOfLines={2}>
        {item.contenido}
      </Text>

      <View style={styles.avisoFooter}>
        <Text style={styles.autorText}>
          {item.autor?.nombre}{item.autor?.numero_casa ? ` • Casa ${item.autor.numero_casa}` : ''}
        </Text>
        <Text style={styles.fechaText}>{formatDate(item.created_at)}</Text>
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
