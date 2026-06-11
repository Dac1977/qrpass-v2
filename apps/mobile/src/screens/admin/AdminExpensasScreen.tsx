import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { getSpaceLabels } from '../../utils/spaceLabels';

export function AdminExpensasScreen() {
  const { profile, space } = useAuthStore();
  const labels = getSpaceLabels(space?.space_type);
  const navigation = useNavigation();
  const [expensas, setExpensas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ periodo: '', descripcion: '', monto: '' });

  const cargar = useCallback(async () => {
    if (!profile?.barrio_id) return;
    try {
      const { data: exp } = await supabase.from('expensas').select('*')
        .eq('barrio_id', profile.barrio_id).order('periodo', { ascending: false });
      setExpensas(exp || []);

      const { data: pag } = await supabase.from('pagos')
        .select('*, expensas!inner(periodo, barrio_id), profiles!pagos_vecino_id_fkey(nombre, numero_casa)')
        .eq('expensas.barrio_id', profile.barrio_id)
        .order('created_at', { ascending: false }).limit(50);
      setPagos((pag || []).map((p: any) => ({
        ...p, vecino_nombre: p.profiles?.nombre, vecino_casa: p.profiles?.numero_casa, periodo: p.expensas?.periodo,
      })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [profile?.barrio_id]);

  useEffect(() => { cargar(); }, [cargar]);
  const onRefresh = () => { setRefreshing(true); cargar(); };

  const crearExpensa = async () => {
    if (!profile?.barrio_id || !form.monto || parseFloat(form.monto) <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido'); return;
    }
    try {
      const { error } = await supabase.from('expensas').insert({
        barrio_id: profile.barrio_id,
        periodo: form.periodo || new Date().toISOString().slice(0, 7),
        descripcion: form.descripcion || 'Expensas',
        monto: parseFloat(form.monto),
      });
      if (error) {
        if (error.code === '23505') { Alert.alert('Error', `Ya existe ${labels.paymentSingular === 'expensa' ? 'una' : 'un'} ${labels.paymentSingular} para ese período`); return; }
        throw error;
      }
      setShowModal(false);
      setForm({ periodo: '', descripcion: '', monto: '' });
      cargar();
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const toggleExpensa = async (id: string, activo: boolean) => {
    await supabase.from('expensas').update({ activo: !activo }).eq('id', id);
    cargar();
  };

  const actualizarPago = async (pagoId: string, estado: 'aprobado' | 'rechazado') => {
    if (!profile?.id) return;
    Alert.alert('Confirmar', estado === 'aprobado' ? '¿Aprobar este pago?' : '¿Rechazar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        await supabase.from('pagos').update({ estado, revisado_por: profile.id, revisado_at: new Date().toISOString() }).eq('id', pagoId);
        cargar();
      }},
    ]);
  };

  const pagosPendientes = pagos.filter(p => p.estado === 'pendiente');

  if (loading) return (
    <View style={s.container}>
      <AppHeader title={labels.payments} showBack onBackPress={() => navigation.goBack()} />
      <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
    </View>
  );

  return (
    <View style={s.container}>
      <AppHeader title={labels.payments} showBack onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={s.addBtnText}>Nueva {labels.paymentSingular.charAt(0).toUpperCase() + labels.paymentSingular.slice(1)}</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>{labels.payments} ({expensas.length})</Text>
        {expensas.map(exp => (
          <View key={exp.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{exp.descripcion}</Text>
              <Text style={s.cardSub}>Período: {exp.periodo} • ${exp.monto}</Text>
              {exp.fecha_vencimiento && <Text style={s.cardMeta}>Vence: {new Date(exp.fecha_vencimiento).toLocaleDateString('es-AR')}</Text>}
            </View>
            <TouchableOpacity onPress={() => toggleExpensa(exp.id, exp.activo)} style={s.toggleBtn}>
              <View style={[s.dot, { backgroundColor: exp.activo ? '#22c55e' : '#64748b' }]} />
              <Text style={[s.toggleText, { color: exp.activo ? '#22c55e' : '#64748b' }]}>{exp.activo ? 'Activa' : 'Inactiva'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {pagosPendientes.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Pagos pendientes ({pagosPendientes.length})</Text>
            {pagosPendientes.map(pago => (
              <View key={pago.id} style={s.card}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{pago.vecino_nombre || 'Sin nombre'}</Text>
                  <Text style={s.cardSub}>{labels.unit} {pago.vecino_casa || 'N/A'} • ${pago.monto}</Text>
                  <Text style={s.cardMeta}>{pago.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Transferencia'} • {pago.periodo}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity style={s.approveSmall} onPress={() => actualizarPago(pago.id, 'aprobado')}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectSmall} onPress={() => actualizarPago(pago.id, 'rechazado')}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>Nueva {labels.paymentSingular.charAt(0).toUpperCase() + labels.paymentSingular.slice(1)}</Text>
            <Text style={s.label}>Período (YYYY-MM)</Text>
            <TextInput style={s.input} placeholder="2025-03" placeholderTextColor="#64748b" value={form.periodo} onChangeText={v => setForm({...form, periodo: v})} />
            <Text style={s.label}>Descripción</Text>
            <TextInput style={s.input} placeholder={labels.payments} placeholderTextColor="#64748b" value={form.descripcion} onChangeText={v => setForm({...form, descripcion: v})} />
            <Text style={s.label}>Monto *</Text>
            <TextInput style={s.input} placeholder="15000" placeholderTextColor="#64748b" value={form.monto} onChangeText={v => setForm({...form, monto: v})} keyboardType="numeric" />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={crearExpensa}>
                <Text style={s.confirmBtnText}>Crear</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', borderRadius: 12, padding: 14, gap: 8, marginBottom: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 10 },
  card: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  toggleBtn: { alignItems: 'center', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  toggleText: { fontSize: 10, fontWeight: '600' },
  approveSmall: { backgroundColor: '#22c55e', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rejectSmall: { backgroundColor: '#ef4444', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
