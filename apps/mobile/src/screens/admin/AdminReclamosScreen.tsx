import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reclamosApi, Reclamo } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { getSpaceLabels } from '../../utils/spaceLabels';

type ReclamoAdmin = Reclamo & { usuario: { nombre: string; numeroCasa: string } | null };

export function AdminReclamosScreen() {
  const { space } = useAuthStore();
  const labels = getSpaceLabels(space?.spaceType);
  const navigation = useNavigation();
  const [reclamos, setReclamos] = useState<ReclamoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [respuestaModal, setRespuestaModal] = useState<{ id: string; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    if (!space?.id) return;
    try {
      const { reclamos: data } = await reclamosApi.listarSpace(space.id);
      setReclamos(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [space?.id]);

  useEffect(() => { cargar(); }, [cargar]);
  const onRefresh = () => { setRefreshing(true); cargar(); };

  const responder = async () => {
    if (!respuestaModal || !respuestaModal.texto.trim()) return;
    try {
      await reclamosApi.responder(respuestaModal.id, { respuesta: respuestaModal.texto, estado: 'en_proceso' });
      setRespuestaModal(null);
      cargar();
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const cambiarEstado = (id: string, titulo: string) => {
    const estados: Array<'en_proceso' | 'resuelto'> = ['en_proceso', 'resuelto'];
    Alert.alert('Cambiar estado', `Reclamo: ${titulo}`, [
      ...estados.map(e => ({
        text: e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' '),
        onPress: async () => {
          try {
            await reclamosApi.responder(id, { respuesta: '', estado: e });
            cargar();
          } catch (err: any) { Alert.alert('Error', err.message); }
        },
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'resuelto': return '#22c55e';
      case 'cerrado': return '#ef4444';
      case 'abierto': return '#f59e0b';
      case 'en_proceso': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const reclamosFiltrados = reclamos.filter(r => filtroEstado === 'todos' || r.estado === filtroEstado);

  if (loading) return (
    <View style={s.container}>
      <AppHeader title="Reclamos" showBack onBackPress={() => navigation.goBack()} />
      <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <AppHeader title="Reclamos" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersContainer}>
        {['todos', 'pendiente', 'en_proceso', 'resuelto'].map(e => (
          <TouchableOpacity key={e} style={[s.chip, filtroEstado === e && s.chipActive]} onPress={() => setFiltroEstado(e)}>
            <Text style={[s.chipText, filtroEstado === e && s.chipTextActive]}>
              {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.resultCount}>{reclamosFiltrados.length} reclamos</Text>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
        {reclamosFiltrados.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>No hay reclamos</Text></View>
        ) : reclamosFiltrados.map(rec => (
          <View key={rec.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle} numberOfLines={1}>{rec.titulo || 'Sin título'}</Text>
                <View style={[s.estadoPill, { backgroundColor: `${estadoColor(rec.estado)}20` }]}>
                  <Text style={[s.estadoText, { color: estadoColor(rec.estado) }]}>
                    {(rec.estado || '').toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text style={s.cardSub} numberOfLines={2}>{rec.descripcion || ''}</Text>
              <Text style={s.cardMeta}>
                {rec.usuario?.nombre || 'Sin nombre'} • {labels.unit} {rec.usuario?.numeroCasa || 'N/A'} • {new Date(rec.createdAt).toLocaleDateString('es-AR')}
              </Text>
              {rec.respuesta && (
                <View style={s.respuestaBox}>
                  <Text style={s.respuestaLabel}>Respuesta:</Text>
                  <Text style={s.respuestaText} numberOfLines={3}>{rec.respuesta}</Text>
                </View>
              )}
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => setRespuestaModal({ id: rec.id, texto: rec.respuesta || '' })}>
                <Ionicons name="chatbubble-outline" size={16} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => cambiarEstado(rec.id, rec.titulo || 'reclamo')}>
                <Ionicons name="swap-horizontal" size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={!!respuestaModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Responder Reclamo</Text>
            <TextInput
              style={[s.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Escribí tu respuesta..."
              placeholderTextColor="#64748b"
              value={respuestaModal?.texto || ''}
              onChangeText={v => respuestaModal && setRespuestaModal({ ...respuestaModal, texto: v })}
              multiline
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRespuestaModal(null)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={responder}>
                <Text style={s.confirmBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingTop: 4 },
  filtersScroll: { maxHeight: 48, marginTop: 8 },
  filtersContainer: { paddingHorizontal: 16, gap: 8 },
  chip: { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  resultCount: { color: '#64748b', fontSize: 12, marginHorizontal: 16, marginTop: 10, marginBottom: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 },
  cardSub: { fontSize: 13, color: '#94a3b8' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  estadoPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  estadoText: { fontSize: 9, fontWeight: '700' },
  respuestaBox: { backgroundColor: '#0f172a', borderRadius: 8, padding: 10, marginTop: 8 },
  respuestaLabel: { fontSize: 11, color: '#3b82f6', fontWeight: '600', marginBottom: 2 },
  respuestaText: { fontSize: 13, color: '#94a3b8' },
  actions: { justifyContent: 'center', gap: 8, marginLeft: 10 },
  actionBtn: { backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
