import React, { useState, useEffect, useCallback } from 'react';
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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { nanoid } from 'nanoid/non-secure';

type AutorizacionDelivery = {
  id: string;
  vecino_id: string;
  nombre_invitado: string;
  qr_code: string;
  valido_desde: string;
  valido_hasta: string;
  usos_permitidos: number;
  usos_actuales: number;
  activo: boolean;
  created_at: string;
};

export function DeliveryScreen() {
  const [autorizaciones, setAutorizaciones] = useState<AutorizacionDelivery[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creando, setCreando] = useState(false);
  const { profile } = useAuthStore();

  const fetchAutorizaciones = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('invitaciones')
      .select('*')
      .eq('vecino_id', profile.id)
      .ilike('nombre_invitado', '%delivery%')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAutorizaciones(data as any);
  };

  useFocusEffect(
    useCallback(() => {
      fetchAutorizaciones();
    }, [profile?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAutorizaciones();
    setRefreshing(false);
  };

  const crearAutorizacion = async () => {
    if (!profile?.id || !profile?.barrio_id) return;

    setCreando(true);
    try {
      const ahora = new Date();
      const expira = new Date(ahora.getTime() + 30 * 60 * 1000); // 30 min

      const qrCode = `DLV-${nanoid(16)}`;

      const { error } = await supabase.from('invitaciones').insert({
        vecino_id: profile.id,
        nombre_invitado: 'Delivery rápido',
        qr_code: qrCode,
        valido_desde: ahora.toISOString(),
        valido_hasta: expira.toISOString(),
        usos_permitidos: 1,
      });

      if (error) throw error;

      fetchAutorizaciones();
      Alert.alert(
        '¡QR de Delivery creado!',
        'El código es válido por 30 minutos. Podés compartirlo con el delivery.',
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setCreando(false);
    }
  };

  const compartirQR = async (item: AutorizacionDelivery) => {
    try {
      await Share.share({
        message: `🚚 Autorización de ingreso - Delivery\n\nCódigo QR: ${item.qr_code}\n\nVálido hasta: ${new Date(item.valido_hasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}\n\nMostrá este código en la guardia del barrio.`,
      });
    } catch {}
  };

  const estaActivo = (item: any) => {
    const expira = new Date(item.valido_hasta);
    return item.activo && item.usos_actuales < item.usos_permitidos && expira > new Date();
  };

  const tiempoRestante = (item: any) => {
    const expira = new Date(item.valido_hasta);
    const ahora = new Date();
    const diff = expira.getTime() - ahora.getTime();
    if (diff <= 0) return 'Expirado';
    const min = Math.floor(diff / 60000);
    return `${min} min restantes`;
  };

  const renderItem = ({ item }: { item: any }) => {
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
              {item.usos_actuales >= item.usos_permitidos ? '✅ Usado' : '⏰ Expirado'}
            </Text>
          )}
        </View>

        <Text style={styles.qrCode}>{item.qr_code}</Text>
        <Text style={styles.fechaText}>
          Creado: {new Date(item.created_at).toLocaleString('es-AR', {
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
