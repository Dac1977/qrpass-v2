import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  RefreshControl,
  Share,
} from 'react-native';
import { invitacionesApi, Invitacion } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export function DeliveryScreen() {
  const [autorizaciones, setAutorizaciones] = useState<Invitacion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creando, setCreando] = useState(false);
  const { space } = useAuthStore();

  const fetchAutorizaciones = async () => {
    if (!space?.id) return;
    try {
      const { invitaciones } = await invitacionesApi.mis(space.id);
      setAutorizaciones(invitaciones.filter(i => i.tipo === 'delivery'));
    } catch {
      // silently ignore
    }
  };

  useFocusEffect(
    useCallback(() => { fetchAutorizaciones(); }, [space?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAutorizaciones();
    setRefreshing(false);
  };

  const crearAutorizacion = async () => {
    if (!space?.id) return;

    setCreando(true);
    try {
      await invitacionesApi.crear({
        spaceId: space.id,
        nombre: 'Delivery rápido',
        tipo: 'delivery',
        usosMaximos: 1,
        horasVigencia: 0.5,
      });
      fetchAutorizaciones();
      Alert.alert(
        '¡QR de Delivery creado!',
        'El código es válido por 30 minutos. Podés compartirlo con el delivery.',
      );
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'No se pudo crear la autorización');
    } finally {
      setCreando(false);
    }
  };

  const compartirQR = async (item: Invitacion) => {
    try {
      await Share.share({
        message: `🚚 Autorización de ingreso - Delivery\n\nCódigo QR: ${item.qrCode}\n\nVálido hasta: ${item.fechaVence ? new Date(item.fechaVence).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Sin vencimiento'}\n\nMostrá este código en la guardia del barrio.`,
      });
    } catch {}
  };

  const estaActivo = (item: Invitacion) => {
    const expira = item.fechaVence ? new Date(item.fechaVence) : null;
    return item.activo && item.usosActuales < item.usosMaximos && (!expira || expira > new Date());
  };

  const tiempoRestante = (item: Invitacion) => {
    if (!item.fechaVence) return 'Activo';
    const expira = new Date(item.fechaVence);
    const diff = expira.getTime() - new Date().getTime();
    if (diff <= 0) return 'Expirado';
    const min = Math.floor(diff / 60000);
    return `${min} min restantes`;
  };

  const renderItem = ({ item }: { item: Invitacion }) => {
    const activo = estaActivo(item);

    return (
      <View style={[styles.card, !activo && styles.cardInactivo]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.statusDot, { backgroundColor: activo ? '#22c55e' : '#6b7280' }]} />
            <Text style={styles.cardTitle}>
              🚚 Delivery
            </Text>
          </View>
          {activo ? (
            <View style={styles.tiempoBadge}>
              <Ionicons name="time" size={14} color="#22c55e" />
              <Text style={styles.tiempoText}>{tiempoRestante(item)}</Text>
            </View>
          ) : (
            <Text style={styles.expiradoText}>
              {item.usosActuales >= item.usosMaximos ? '✅ Usado' : '⏰ Expirado'}
            </Text>
          )}
        </View>

        <Text style={styles.qrCode}>{item.qrCode}</Text>
        <Text style={styles.fechaText}>
          Creado: {new Date(item.createdAt).toLocaleString('es-AR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </Text>

        {activo && (
          <TouchableOpacity style={styles.compartirBtn} onPress={() => compartirQR(item)}>
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={styles.compartirBtnText}>Compartir con delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery Rápido</Text>
      <Text style={styles.subtitle}>
        Generá un QR temporal de 30 minutos para autorizar el ingreso de un delivery
      </Text>

      <TouchableOpacity
        style={[styles.crearBtn, creando && { opacity: 0.5 }]}
        onPress={crearAutorizacion}
        disabled={creando}
      >
        <Ionicons name="qr-code" size={22} color="#fff" />
        <Text style={styles.crearBtnText}>
          {creando ? 'Generando...' : 'Generar QR para Delivery'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={autorizaciones}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyText}>No hay autorizaciones recientes</Text>
            <Text style={styles.emptySubtext}>Tocá el botón para generar un QR temporal</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', paddingHorizontal: 20, paddingTop: 16 },
  subtitle: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 20, marginTop: 4, marginBottom: 16 },
  crearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#e94560', marginHorizontal: 20, borderRadius: 14, paddingVertical: 16,
  },
  crearBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  list: { padding: 16, paddingTop: 12 },
  card: {
    backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#0f3460',
  },
  cardInactivo: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  tiempoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tiempoText: { fontSize: 13, color: '#22c55e', fontWeight: '600' },
  expiradoText: { fontSize: 13, color: '#6b7280' },
  qrCode: { fontSize: 14, color: '#64748b', marginTop: 10, fontFamily: 'monospace' },
  fechaText: { fontSize: 12, color: '#475569', marginTop: 4 },
  compartirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, marginTop: 12,
  },
  compartirBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});
