import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { eventosApi, Evento } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';

export function EventosScreen() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { profile, space } = useAuthStore();
  const navigation = useNavigation<any>();

  const fetchEventos = async () => {
    if (!space?.id) return;
    try {
      const { events } = await eventosApi.listar(space.id);
      const mios = events.filter(e => e.organizadorId === profile?.id);
      setEventos(mios);
    } catch {
      // silently ignore
    }
  };

  useFocusEffect(
    useCallback(() => { fetchEventos(); }, [space?.id, profile?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEventos();
    setRefreshing(false);
  };

  const cancelarEvento = async (evento: Evento) => {
    Alert.alert('Confirmar', '¿Cancelar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cancelar evento', style: 'destructive', onPress: async () => {
          try {
            await eventosApi.actualizar(evento.id, { activo: false });
            fetchEventos();
            Alert.alert('Éxito', 'Evento cancelado');
          } catch (error) {
            console.error('Error cancelando evento:', error);
            Alert.alert('Error', 'No se pudo cancelar el evento');
          }
        },
      },
    ]);
  };

  const formatFecha = (fecha: string) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isEventoFuturo = (fecha: string) => new Date(fecha) > new Date();

  const renderEvento = ({ item }: { item: Evento }) => (
    <TouchableOpacity
      style={[styles.eventoCard, !item.activo && styles.eventoInactivo]}
      onPress={() => navigation.navigate('DetalleEvento', { eventoId: item.id })}
    >
      <View style={styles.eventoHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventoNombre}>{item.nombre}</Text>
          <Text style={styles.eventoFecha}>📅 {formatFecha(item.fechaEvento)}</Text>
        </View>
        {!item.activo ? (
          <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.badgeText}>Cancelado</Text>
          </View>
        ) : !isEventoFuturo(item.fechaEvento) ? (
          <View style={[styles.badge, { backgroundColor: '#6b7280' }]}>
            <Text style={styles.badgeText}>Pasado</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
            <Text style={styles.badgeText}>Activo</Text>
          </View>
        )}
      </View>
      {item.descripcion ? (
        <Text style={styles.eventoDesc} numberOfLines={2}>{item.descripcion}</Text>
      ) : null}
      <View style={styles.eventoFooter}>
        {item.activo && isEventoFuturo(item.fechaEvento) && (
          <TouchableOpacity onPress={() => cancelarEvento(item)}>
            <Text style={styles.cancelarText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Mis Eventos" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.crearBtn}
          onPress={() => navigation.navigate('CrearEvento')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.crearBtnText}>Nuevo Evento</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={eventos}
        keyExtractor={(item) => item.id}
        renderItem={renderEvento}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>No tenés eventos creados</Text>
            <Text style={styles.emptySubtext}>Creá uno para invitar a muchas personas a la vez</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  crearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  crearBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16 },
  eventoCard: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  eventoInactivo: { opacity: 0.5 },
  eventoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventoNombre: { fontSize: 18, fontWeight: '700', color: '#fff' },
  eventoFecha: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  eventoDesc: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
  eventoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    paddingTop: 12,
  },
  invitadosCount: { fontSize: 14, color: '#e2e8f0' },
  cancelarText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});
