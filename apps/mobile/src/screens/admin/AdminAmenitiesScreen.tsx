import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { amenitiesApi, Amenity } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { getSpaceLabels } from '../../utils/spaceLabels';

const makeTurno = () => ({
  id: Math.random().toString(36).slice(2, 9),
  etiqueta: '',
  hora_inicio: '08:00',
  hora_fin: '09:00',
});

export function AdminAmenitiesScreen() {
  const { space } = useAuthStore();
  const labels = getSpaceLabels(space?.spaceType);
  const navigation = useNavigation();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', capacidad: '', hora_apertura: '08:00', hora_cierre: '22:00', requiere_aprobacion: false, precio_reserva: '0' });
  const [turnos, setTurnos] = useState<{ id: string; etiqueta: string; hora_inicio: string; hora_fin: string; }[]>([makeTurno()]);

  const cargar = useCallback(async () => {
    if (!space?.id) return;
    try {
      const { amenities: data } = await amenitiesApi.listar(space.id);
      setAmenities(data);
      const { reservas: reservasData } = await amenitiesApi.reservasSpace(space.id);
      setReservas(reservasData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [space?.id]);

  useEffect(() => { cargar(); }, [cargar]);
  const onRefresh = () => { setRefreshing(true); cargar(); };

  const toggleAmenity = async (id: string, activo: boolean) => {
    try {
      await amenitiesApi.toggle(id, !activo);
      cargar();
    } catch (error) {
      console.error('Error toggling amenity:', error);
      Alert.alert('Error', 'No se pudo actualizar el amenity');
    }
  };

  const actualizarReserva = async (id: string, estado: string) => {
    try {
      await amenitiesApi.actualizarReserva(id, { estado });
      cargar();
    } catch (error) {
      console.error('Error actualizando reserva:', error);
      Alert.alert('Error', 'No se pudo actualizar la reserva');
    }
  };

  const reservasPendientes = reservas.filter(r => r.estado === 'pendiente');

  const guardarAmenity = async () => {
    if (!space?.id || !form.nombre.trim()) return;
    try {
      await amenitiesApi.crear({
        spaceId: space.id,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        capacidad: form.capacidad ? parseInt(form.capacidad) : undefined,
        horaApertura: form.hora_apertura,
        horaCierre: form.hora_cierre,
        requiereAprobacion: form.requiere_aprobacion,
        precioReserva: parseFloat(form.precio_reserva) || 0,
        turnosConfig: turnos,
        activo: true,
      });
      setShowModal(false);
      setForm({ nombre: '', descripcion: '', capacidad: '', hora_apertura: '08:00', hora_cierre: '22:00', requiere_aprobacion: false, precio_reserva: '0' });
      setTurnos([makeTurno()]);
      cargar();
      Alert.alert('Éxito', 'Amenity creado correctamente');
    } catch (error) {
      console.error('Error creando amenity:', error);
      Alert.alert('Error', 'No se pudo crear el amenity');
    }
  };

  if (loading) return (
    <View style={s.container}>
      <AppHeader title="Amenities" showBack onBackPress={() => navigation.goBack()} />
      <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <AppHeader title="Amenities" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>

        <View style={s.rowBetween}>
          <Text style={s.sectionTitle}>Amenities ({amenities.length})</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnText}>Nueva</Text>
          </TouchableOpacity>
        </View>
        {amenities.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>No hay amenities configurados</Text></View>
        ) : amenities.map(am => (
          <View key={am.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{am.nombre}</Text>
              <Text style={s.cardSub}>
                {am.capacidad ? `Capacidad: ${am.capacidad}` : 'Sin límite'}
                {am.horaApertura && am.horaCierre ? ` • ${am.horaApertura.slice(0,5)} - ${am.horaCierre.slice(0,5)}` : ''}
              </Text>
              {am.descripcion && <Text style={s.cardMeta} numberOfLines={2}>{am.descripcion}</Text>}
              {am.precioReserva > 0 && <Text style={s.precioBadge}>${am.precioReserva} por reserva</Text>}
              {am.requiereAprobacion && <Text style={s.requiresApproval}>Requiere aprobación</Text>}
            </View>
            <TouchableOpacity onPress={() => toggleAmenity(am.id, am.activo)} style={s.toggleBtn}>
              <View style={[s.dot, { backgroundColor: am.activo ? '#22c55e' : '#64748b' }]} />
              <Text style={[s.toggleText, { color: am.activo ? '#22c55e' : '#64748b' }]}>{am.activo ? 'Activo' : 'Inactivo'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {reservasPendientes.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Reservas pendientes ({reservasPendientes.length})</Text>
            {reservasPendientes.map(res => (
              <View key={res.id} style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{res.amenity_nombre}</Text>
                  <Text style={s.cardSub}>{res.vecino_nombre || 'Sin nombre'} • {labels.unit} {res.vecino_casa || 'N/A'}</Text>
                  <Text style={s.cardMeta}>
                    {new Date(res.fecha).toLocaleDateString('es-AR')}
                    {res.turno_etiqueta ? ` • ${res.turno_etiqueta}` : ''}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={s.approveSmall} onPress={() => actualizarReserva(res.id, 'confirmada')}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectSmall} onPress={() => actualizarReserva(res.id, 'cancelada')}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {reservas.filter(r => r.estado !== 'pendiente').length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Historial de reservas</Text>
            {reservas.filter(r => r.estado !== 'pendiente').slice(0, 10).map(res => (
              <View key={res.id} style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{res.amenity_nombre}</Text>
                  <Text style={s.cardSub}>{res.vecino_nombre || 'Sin nombre'} • {new Date(res.fecha).toLocaleDateString('es-AR')}</Text>
                </View>
                <View style={[s.estadoPill, { backgroundColor: res.estado === 'confirmada' ? '#22c55e20' : '#ef444420' }]}>
                  <Text style={[s.estadoText, { color: res.estado === 'confirmada' ? '#22c55e' : '#ef4444' }]}>
                    {(res.estado || '').toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nueva Amenity</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalScroll}>
            <Text style={s.label}>Nombre *</Text>
            <TextInput
              style={s.input}
              value={form.nombre}
              onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
              placeholder="Ej: Pileta, SUM, Cancha"
              placeholderTextColor="#475569"
            />
            <Text style={s.label}>Descripción</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.descripcion}
              onChangeText={v => setForm(f => ({ ...f, descripcion: v }))}
              placeholder="Descripción opcional"
              placeholderTextColor="#475569"
              multiline
            />
            <Text style={s.label}>Capacidad máxima</Text>
            <TextInput
              style={s.input}
              value={form.capacidad}
              onChangeText={v => setForm(f => ({ ...f, capacidad: v }))}
              placeholder="Dejar vacío para sin límite"
              placeholderTextColor="#475569"
              keyboardType="numeric"
            />
            <View style={s.rowEqual}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Apertura</Text>
                <TextInput
                  style={s.input}
                  value={form.hora_apertura}
                  onChangeText={v => setForm(f => ({ ...f, hora_apertura: v }))}
                  placeholder="08:00"
                  placeholderTextColor="#475569"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Cierre</Text>
                <TextInput
                  style={s.input}
                  value={form.hora_cierre}
                  onChangeText={v => setForm(f => ({ ...f, hora_cierre: v }))}
                  placeholder="22:00"
                  placeholderTextColor="#475569"
                />
              </View>
            </View>
            <Text style={s.label}>Precio por reserva ($ ARS, 0 = gratis)</Text>
            <TextInput
              style={s.input}
              value={form.precio_reserva}
              onChangeText={v => setForm(f => ({ ...f, precio_reserva: v }))}
              placeholder="0"
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
            />
            <View style={s.switchRow}>
              <Text style={s.label}>Requiere aprobación</Text>
              <Switch
                value={form.requiere_aprobacion}
                onValueChange={v => setForm(f => ({ ...f, requiere_aprobacion: v }))}
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.rowBetween}>
              <Text style={s.label}>Turnos</Text>
              <TouchableOpacity onPress={() => setTurnos(t => [...t, makeTurno()])}>
                <Ionicons name="add-circle" size={22} color="#3b82f6" />
              </TouchableOpacity>
            </View>
            {turnos.map((t, i) => (
              <View key={t.id} style={s.turnoRow}>
                <TextInput
                  style={[s.input, { flex: 2 }]}
                  value={t.etiqueta}
                  onChangeText={v => setTurnos(ts => ts.map((x, j) => j === i ? { ...x, etiqueta: v } : x))}
                  placeholder="Etiqueta"
                  placeholderTextColor="#475569"
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={t.hora_inicio}
                  onChangeText={v => setTurnos(ts => ts.map((x, j) => j === i ? { ...x, hora_inicio: v } : x))}
                  placeholder="Inicio"
                  placeholderTextColor="#475569"
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={t.hora_fin}
                  onChangeText={v => setTurnos(ts => ts.map((x, j) => j === i ? { ...x, hora_fin: v } : x))}
                  placeholder="Fin"
                  placeholderTextColor="#475569"
                />
                {turnos.length > 1 && (
                  <TouchableOpacity onPress={() => setTurnos(ts => ts.filter((_, j) => j !== i))}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelModalBtn} onPress={() => setShowModal(false)}>
              <Text style={s.cancelModalText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={guardarAmenity}>
              <Text style={s.saveBtnText}>Guardar Amenity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  precioBadge: { fontSize: 11, color: '#22c55e', marginTop: 4, fontWeight: '600' },
  requiresApproval: { fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: '600' },
  toggleBtn: { alignItems: 'center', gap: 4, marginLeft: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  toggleText: { fontSize: 10, fontWeight: '600' },
  approveSmall: { backgroundColor: '#22c55e', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rejectSmall: { backgroundColor: '#ef4444', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  estadoPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  estadoText: { fontSize: 10, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rowEqual: { flexDirection: 'row', gap: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  modalScroll: { padding: 20, paddingBottom: 40 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  turnoRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  cancelModalBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center', padding: 14 },
  cancelModalText: { color: '#94a3b8', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#3b82f6', borderRadius: 14, alignItems: 'center', padding: 14 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
