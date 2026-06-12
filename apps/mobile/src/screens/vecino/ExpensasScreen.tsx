import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { expensasApi, Expensa } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const formatPeriodo = (mes: number, anio: number) => `${MESES[mes - 1]} ${anio}`;

const COBROS_LABELS: Record<string, { titulo: string; empty: string }> = {
  residential: { titulo: 'Expensas',  empty: 'No hay expensas publicadas' },
  gym:         { titulo: 'Cuotas',    empty: 'No hay cuotas publicadas' },
  club:        { titulo: 'Cuotas',    empty: 'No hay cuotas publicadas' },
  coworking:   { titulo: 'Alquiler',  empty: 'No hay cobros publicados' },
  event:       { titulo: 'Cobros',    empty: 'No hay cobros publicados' },
  other:       { titulo: 'Cobros',    empty: 'No hay cobros publicados' },
};

export function ExpensasScreen() {
  const { space } = useAuthStore();
  const lbl = COBROS_LABELS[space?.spaceType ?? 'residential'] ?? COBROS_LABELS.other;
  const [expensas, setExpensas] = useState<Expensa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagandoId, setPagandoId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { expensas: data } = await expensasApi.listarMias();
      setExpensas(data.sort((a, b) => b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes));
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const marcarPagada = async (exp: Expensa) => {
    Alert.alert(
      'Confirmar pago',
      `¿Marcar como pagada la expensa de ${formatPeriodo(exp.mes, exp.anio)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            setPagandoId(exp.id);
            try {
              const { expensa } = await expensasApi.pagar(exp.id);
              setExpensas(prev => prev.map(e => e.id === expensa.id ? expensa : e));
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo registrar el pago');
            } finally {
              setPagandoId(null);
            }
          },
        },
      ]
    );
  };

  const getEstado = (estado: Expensa['estado']) => {
    if (estado === 'pagada') return { label: 'Pagada ✓', color: '#22c55e', icon: 'checkmark-circle' as const };
    return { label: 'Pendiente de pago', color: '#f97316', icon: 'alert-circle' as const };
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>{lbl.titulo}</Text>
      {expensas.length === 0 ? (
        <View style={s.emptyBox}><Ionicons name="receipt-outline" size={48} color="#334155" /><Text style={s.emptyText}>{lbl.empty}</Text></View>
      ) : expensas.map((exp) => {
        const est = getEstado(exp.estado);
        const paid = exp.estado === 'pagada';
        const isPagando = pagandoId === exp.id;
        return (
          <View key={exp.id} style={[s.card, paid && s.cardPaid]}>
            <View style={s.cardHeader}>
              <Text style={s.periodo}>{formatPeriodo(exp.mes, exp.anio)}</Text>
              <Text style={s.monto}>${exp.monto.toLocaleString('es-AR')}</Text>
            </View>
            {exp.fechaVenc && <Text style={s.venc}>Vencimiento: {new Date(exp.fechaVenc).toLocaleDateString('es-AR')}</Text>}
            {exp.fechaPago && <Text style={s.venc}>Pagada el: {new Date(exp.fechaPago).toLocaleDateString('es-AR')}</Text>}
            <View style={[s.badge, { backgroundColor: est.color + '20' }]}>
              <Ionicons name={est.icon} size={16} color={est.color} /><Text style={[s.badgeText, { color: est.color }]}>{est.label}</Text>
            </View>
            {!paid && (
              <TouchableOpacity style={s.payBtn} onPress={() => marcarPagada(exp)} disabled={!!pagandoId}>
                {isPagando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.payBtnText}>Marcar como pagada</Text>}
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#475569', fontSize: 15 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardPaid: { borderColor: '#22c55e40' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  periodo: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  monto: { fontSize: 20, fontWeight: '700', color: '#38bdf8' },
  venc: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, gap: 6, marginTop: 8 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  payBtn: { marginTop: 12, backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
