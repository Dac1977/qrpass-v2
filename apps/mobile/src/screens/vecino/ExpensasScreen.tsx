import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Image, Linking, Modal, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase, Expensa, Pago, ConfigPagos } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { getSpaceLabels } from '../../utils/spaceLabels';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const formatPeriodo = (p: string) => { const [y,m] = p.split('-'); return `${MESES[parseInt(m)-1]} ${y}`; };

const COBROS_LABELS: Record<string, { titulo: string; singular: string; empty: string }> = {
  residential: { titulo: 'Expensas', singular: 'expensa', empty: 'No hay expensas publicadas' },
  gym:         { titulo: 'Cuotas',   singular: 'cuota',   empty: 'No hay cuotas publicadas' },
  club:        { titulo: 'Cuotas',   singular: 'cuota',   empty: 'No hay cuotas publicadas' },
  coworking:   { titulo: 'Alquiler', singular: 'alquiler',empty: 'No hay cobros publicados' },
  event:       { titulo: 'Cobros',   singular: 'cobro',   empty: 'No hay cobros publicados' },
  other:       { titulo: 'Cobros',   singular: 'cobro',   empty: 'No hay cobros publicados' },
};

export function ExpensasScreen({ navigation }: any) {
  const { profile, space } = useAuthStore();
  const lbl = COBROS_LABELS[space?.space_type ?? 'residential'] ?? COBROS_LABELS.other;
  const [expensas, setExpensas] = useState<(Expensa & { pago?: Pago })[]>([]);
  const [configPagos, setConfigPagos] = useState<ConfigPagos | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [expensaSel, setExpensaSel] = useState<Expensa | null>(null);
  const [comprobanteUri, setComprobanteUri] = useState<string | null>(null);
  const [subiendoComp, setSubiendoComp] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [profile?.barrio_id]);

  const fetchData = async () => {
    if (!profile?.barrio_id || !profile?.id) return;
    setLoading(true);
    const [{ data: expData }, { data: pagosData }, { data: cfgData }] = await Promise.all([
      supabase.from('expensas').select('*').eq('barrio_id', profile.barrio_id).eq('activo', true).order('periodo', { ascending: false }),
      supabase.from('pagos').select('*').eq('vecino_id', profile.id).in('estado', ['pendiente', 'aprobado']),
      supabase.from('configuracion_pagos').select('id,barrio_id,mp_habilitado,banco_nombre,banco_titular,banco_cbu,banco_alias,transferencia_habilitada').eq('barrio_id', profile.barrio_id).maybeSingle(),
    ]);
    if (cfgData) setConfigPagos(cfgData as ConfigPagos);
    const pagosMap: Record<string, Pago> = {};
    if (pagosData) for (const p of pagosData as Pago[]) {
      const ex = pagosMap[p.expensa_id];
      if (!ex || p.estado === 'aprobado' || (p.estado === 'pendiente' && ex.estado !== 'aprobado')) pagosMap[p.expensa_id] = p;
    }
    setExpensas(((expData as Expensa[]) || []).map(e => ({ ...e, pago: pagosMap[e.id] })));
    setLoading(false);
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, [profile?.barrio_id, profile?.id]);

  const pagarConMP = async (exp: Expensa) => {
    if (!profile?.id) return;
    setPagando(true);
    try {
      const { data, error } = await supabase.functions.invoke('crear-preferencia-mp', {
        body: { expensa_id: exp.id, vecino_id: profile.id },
      });
      if (error) throw new Error(error.message || 'Error al crear preferencia');
      if (data?.init_point) await Linking.openURL(data.init_point);
      else throw new Error(data?.error || 'No se recibió el link de pago');
    } catch (e: any) {
      console.error('Error MP:', e);
      Alert.alert('Error', e.message || 'No se pudo iniciar el pago');
    } finally { setPagando(false); }
  };

  const elegirComprobante = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.7 });
    if (!result.canceled && result.assets[0]) setComprobanteUri(result.assets[0].uri);
  };

  const enviarComprobante = async () => {
    if (!comprobanteUri || !expensaSel || !profile?.id) return;
    setSubiendoComp(true);
    try {
      const resp = await fetch(comprobanteUri);
      const blob = await resp.blob();
      const ab = await new Response(blob).arrayBuffer();
      const path = `${profile.barrio_id}/${profile.id}/${expensaSel.id}.jpg`;
      const { error: upErr } = await supabase.storage.from('comprobantes-pago').upload(path, ab, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('comprobantes-pago').getPublicUrl(path);
      const { error: pagoErr } = await supabase.from('pagos').insert({
        expensa_id: expensaSel.id, vecino_id: profile.id, monto: expensaSel.monto,
        metodo_pago: 'transferencia', estado: 'pendiente', comprobante_url: urlData.publicUrl + '?t=' + Date.now(),
      });
      if (pagoErr) throw pagoErr;
      setShowTransferencia(false);
      Alert.alert('Enviado', 'Comprobante enviado. El administrador revisará tu pago.');
      fetchData();
    } catch (e: any) { console.error(e); Alert.alert('Error', 'No se pudo enviar el comprobante.'); }
    finally { setSubiendoComp(false); }
  };

  const copyTo = async (text: string, field: string) => {
    try { await Clipboard.setStringAsync(text); setCopiedField(field); setTimeout(() => setCopiedField(null), 2000); } catch {}
  };

  const getEstado = (pago?: Pago) => {
    if (!pago) return { label: 'Pendiente de pago', color: '#f97316', icon: 'alert-circle' as const };
    if (pago.estado === 'aprobado') return { label: 'Pagada ✓', color: '#22c55e', icon: 'checkmark-circle' as const };
    if (pago.estado === 'pendiente') return { label: 'Pago en revisión', color: '#eab308', icon: 'time' as const };
    return { label: 'Pago rechazado', color: '#ef4444', icon: 'close-circle' as const };
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  const noConfig = !configPagos || (!configPagos.mp_habilitado && !configPagos.transferencia_habilitada);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>{lbl.titulo}</Text>
      {noConfig && <View style={s.infoBox}><Ionicons name="information-circle" size={20} color="#38bdf8" /><Text style={s.infoText}>El administrador aún no configuró los métodos de pago.</Text></View>}
      {expensas.length === 0 ? (
        <View style={s.emptyBox}><Ionicons name="receipt-outline" size={48} color="#334155" /><Text style={s.emptyText}>{lbl.empty}</Text></View>
      ) : expensas.map((exp) => {
        const est = getEstado(exp.pago);
        const paid = exp.pago?.estado === 'aprobado';
        const pending = exp.pago?.estado === 'pendiente';
        const canPay = !paid && !pending;
        return (
          <View key={exp.id} style={[s.card, paid && s.cardPaid]}>
            <View style={s.cardHeader}>
              <View><Text style={s.periodo}>{formatPeriodo(exp.periodo)}</Text><Text style={s.desc}>{exp.descripcion}</Text></View>
              <Text style={s.monto}>${exp.monto.toLocaleString('es-AR')}</Text>
            </View>
            {exp.fecha_vencimiento && <Text style={s.venc}>Vencimiento: {new Date(exp.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-AR')}</Text>}
            <View style={[s.badge, { backgroundColor: est.color + '20' }]}>
              <Ionicons name={est.icon} size={16} color={est.color} /><Text style={[s.badgeText, { color: est.color }]}>{est.label}</Text>
            </View>
            {canPay && !noConfig && (
              <View style={s.payBtns}>
                {configPagos?.mp_habilitado && (
                  <TouchableOpacity style={s.mpBtn} onPress={() => pagarConMP(exp)} disabled={pagando}>
                    {pagando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.mpBtnText}>Pagar con Mercado Pago</Text>}
                  </TouchableOpacity>
                )}
                {configPagos?.transferencia_habilitada && (
                  <TouchableOpacity style={s.transBtn} onPress={() => { setExpensaSel(exp); setComprobanteUri(null); setShowTransferencia(true); }}>
                    <Ionicons name="swap-horizontal" size={18} color="#fff" /><Text style={s.transBtnText}>Transferencia</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Modal visible={showTransferencia} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>Transferencia Bancaria</Text>
            {configPagos && (
              <View style={s.bankInfo}>
                {configPagos.banco_nombre && <Text style={s.bankText}>Banco: {configPagos.banco_nombre}</Text>}
                {configPagos.banco_titular && <Text style={s.bankText}>Titular: {configPagos.banco_titular}</Text>}
                {configPagos.banco_cbu && (
                  <TouchableOpacity style={s.copyRow} onPress={() => copyTo(configPagos.banco_cbu!, 'cbu')}>
                    <Text style={s.bankText}>CBU: {configPagos.banco_cbu}</Text>
                    <Text style={s.copyLabel}>{copiedField === 'cbu' ? '✓' : 'Copiar'}</Text>
                  </TouchableOpacity>
                )}
                {configPagos.banco_alias && (
                  <TouchableOpacity style={s.copyRow} onPress={() => copyTo(configPagos.banco_alias!, 'alias')}>
                    <Text style={s.bankText}>Alias: {configPagos.banco_alias}</Text>
                    <Text style={s.copyLabel}>{copiedField === 'alias' ? '✓' : 'Copiar'}</Text>
                  </TouchableOpacity>
                )}
                {expensaSel && <Text style={s.bankMonto}>Monto: ${expensaSel.monto.toLocaleString('es-AR')}</Text>}
              </View>
            )}
            <Text style={s.compLabel}>Subí el comprobante:</Text>
            {comprobanteUri ? (
              <View style={s.compPreview}>
                <Image source={{ uri: comprobanteUri }} style={s.compImg} />
                <TouchableOpacity onPress={() => setComprobanteUri(null)}><Text style={s.compChange}>Cambiar</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.compBtn} onPress={elegirComprobante}>
                <Ionicons name="image-outline" size={28} color="#38bdf8" /><Text style={s.compBtnText}>Elegir imagen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.sendBtn, (!comprobanteUri || subiendoComp) && s.sendBtnOff]} onPress={enviarComprobante} disabled={!comprobanteUri || subiendoComp}>
              {subiendoComp ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendBtnText}>Enviar comprobante</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowTransferencia(false)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 20 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c4a6e', borderRadius: 12, padding: 12, marginBottom: 16, gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#7dd3fc' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#475569', fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardPaid: { borderColor: '#22c55e40' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  periodo: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  desc: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  monto: { fontSize: 20, fontWeight: '700', color: '#38bdf8' },
  venc: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, gap: 6 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  payBtns: { marginTop: 12, gap: 8 },
  mpBtn: { backgroundColor: '#009ee3', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  mpBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  transBtn: { flexDirection: 'row', backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  transBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 16 },
  bankInfo: { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 16, gap: 6 },
  bankText: { fontSize: 14, color: '#e2e8f0' },
  copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  copyLabel: { fontSize: 12, color: '#38bdf8', fontWeight: '600' },
  bankMonto: { fontSize: 16, fontWeight: '700', color: '#22c55e', marginTop: 8 },
  compLabel: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  compPreview: { alignItems: 'center', marginBottom: 12 },
  compImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  compChange: { color: '#38bdf8', fontSize: 13 },
  compBtn: { borderWidth: 1, borderColor: '#334155', borderStyle: 'dashed', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 12, gap: 6 },
  compBtnText: { color: '#64748b', fontSize: 13 },
  sendBtn: { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  sendBtnOff: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#64748b', fontSize: 15 },
});
