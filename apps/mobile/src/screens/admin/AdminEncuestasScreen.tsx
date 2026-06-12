import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { encuestasApi, Encuesta } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';

export function AdminEncuestasScreen() {
  const { space } = useAuthStore();
  const navigation = useNavigation();
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', opciones: ['', ''], multiple: false });

  const cargar = useCallback(async () => {
    if (!space?.id) return;
    try {
      const { encuestas: data } = await encuestasApi.listar(space.id);
      setEncuestas(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [space?.id]);

  useEffect(() => { cargar(); }, [cargar]);
  const onRefresh = () => { setRefreshing(true); cargar(); };

  const crearEncuesta = async () => {
    if (!space?.id || !form.titulo.trim() || form.opciones.some(o => !o.trim())) {
      Alert.alert('Error', 'Completá el título y al menos 2 opciones');
      return;
    }
    try {
      await encuestasApi.crear({
        spaceId: space.id,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        opciones: form.opciones.map(o => o.trim()),
        multiple: form.multiple,
      });
      setShowModal(false);
      setForm({ titulo: '', descripcion: '', opciones: ['', ''], multiple: false });
      cargar();
      Alert.alert('Éxito', 'Encuesta creada correctamente');
    } catch (error) {
      console.error('Error creando encuesta:', error);
      Alert.alert('Error', 'No se pudo crear la encuesta');
    }
  };

  const toggleEncuesta = async (id: string, activa: boolean) => {
    try {
      await encuestasApi.actualizar(id, { activa: !activa });
      cargar();
    } catch (error) {
      console.error('Error toggling encuesta:', error);
      Alert.alert('Error', 'No se pudo actualizar la encuesta');
    }
  };

  const agregarOpcion = () => setForm({ ...form, opciones: [...form.opciones, ''] });

  const actualizarOpcion = (index: number, value: string) => {
    const opciones = [...form.opciones];
    opciones[index] = value;
    setForm({ ...form, opciones });
  };

  const eliminarOpcion = (index: number) => {
    if (form.opciones.length <= 2) return;
    setForm({ ...form, opciones: form.opciones.filter((_, i) => i !== index) });
  };

  if (loading) return (
    <View style={s.container}>
      <AppHeader title="Encuestas" showBack onBackPress={() => navigation.goBack()} />
      <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <AppHeader title="Encuestas" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={s.addBtnText}>Nueva Encuesta</Text>
        </TouchableOpacity>

        {encuestas.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>No hay encuestas creadas</Text></View>
        ) : encuestas.map(enc => (
          <View key={enc.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{enc.titulo}</Text>
              {enc.descripcion && <Text style={s.cardSub} numberOfLines={2}>{enc.descripcion}</Text>}
              <Text style={s.cardMeta}>
                {Array.isArray(enc.opciones) ? `${enc.opciones.length} opciones` : ''} • 
                {enc.multiple ? ' Múltiple' : ' Simple'} • 
                Creada: {new Date(enc.createdAt).toLocaleDateString('es-AR')}
              </Text>
              {Array.isArray(enc.opciones) && (
                <View style={s.opcionesPreview}>
                  {enc.opciones.slice(0, 4).map((op: string, i: number) => (
                    <Text key={i} style={s.opcionChip} numberOfLines={1}>• {op}</Text>
                  ))}
                  {enc.opciones.length > 4 && <Text style={s.opcionChip}>+{enc.opciones.length - 4} más</Text>}
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => toggleEncuesta(enc.id, enc.activa)} style={s.toggleBtn}>
              <View style={[s.dot, { backgroundColor: enc.activa ? '#22c55e' : '#64748b' }]} />
              <Text style={[s.toggleText, { color: enc.activa ? '#22c55e' : '#64748b' }]}>{enc.activa ? 'Activa' : 'Cerrada'}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalScroll}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Nueva Encuesta</Text>
              <Text style={s.label}>Título *</Text>
              <TextInput style={s.input} placeholder="Pregunta o tema" placeholderTextColor="#64748b" value={form.titulo} onChangeText={v => setForm({...form, titulo: v})} />
              <Text style={s.label}>Descripción</Text>
              <TextInput style={s.input} placeholder="Opcional" placeholderTextColor="#64748b" value={form.descripcion} onChangeText={v => setForm({...form, descripcion: v})} />

              <Text style={s.label}>Opciones *</Text>
              {form.opciones.map((op, i) => (
                <View key={i} style={s.opcionRow}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder={`Opción ${i + 1}`} placeholderTextColor="#64748b" value={op} onChangeText={v => actualizarOpcion(i, v)} />
                  {form.opciones.length > 2 && (
                    <TouchableOpacity onPress={() => eliminarOpcion(i)} style={s.removeOpBtn}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={s.addOpBtn} onPress={agregarOpcion}>
                <Ionicons name="add" size={18} color="#3b82f6" />
                <Text style={s.addOpBtnText}>Agregar opción</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.checkRow} onPress={() => setForm({...form, multiple: !form.multiple})}>
                <View style={[s.checkbox, form.multiple && s.checkboxActive]}>
                  {form.multiple && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={s.checkLabel}>Permitir múltiples respuestas</Text>
              </TouchableOpacity>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={crearEncuesta}>
                  <Text style={s.confirmBtnText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#8b5cf6', borderRadius: 12, padding: 14, gap: 8, marginBottom: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  opcionesPreview: { marginTop: 6, gap: 2 },
  opcionChip: { fontSize: 12, color: '#94a3b8' },
  toggleBtn: { alignItems: 'center', gap: 4, marginLeft: 10, marginTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  toggleText: { fontSize: 10, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalScroll: { flex: 1, marginTop: 60 },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  opcionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  removeOpBtn: { padding: 4 },
  addOpBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addOpBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  checkLabel: { color: '#94a3b8', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#8b5cf6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
