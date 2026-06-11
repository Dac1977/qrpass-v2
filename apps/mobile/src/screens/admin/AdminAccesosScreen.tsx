import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/AppHeader';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type Terminal = { id: string; nombre: string; activo: boolean };
type Gate = { id: string; terminal_id: string; nombre: string; tipo: 'IN' | 'OUT' | 'BOTH'; activo: boolean; orden: number };

const TIPO_LABELS = { IN: '🟢 Solo Entrada', OUT: '🔴 Solo Salida', BOTH: '🔵 Entrada y Salida' };

export function AdminAccesosScreen() {
  const { profile } = useAuthStore();
  const [terminales, setTerminales] = useState<Terminal[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);

  // Modal nueva terminal
  const [showNuevaTerminal, setShowNuevaTerminal] = useState(false);
  const [nombreTerminal, setNombreTerminal] = useState('');

  // Modal nuevo gate
  const [showNuevoGate, setShowNuevoGate] = useState<string | null>(null); // terminal_id
  const [gateNombre, setGateNombre] = useState('');
  const [gateTipo, setGateTipo] = useState<'IN' | 'OUT' | 'BOTH'>('BOTH');

  const cargar = useCallback(async () => {
    if (!profile?.barrio_id) return;
    setLoading(true);
    const [{ data: ts }, { data: gs }] = await Promise.all([
      supabase.from('terminales').select('id, nombre, activo').eq('barrio_id', profile.barrio_id).order('created_at'),
      supabase.from('puntos_acceso').select('id, terminal_id, nombre, tipo, activo, orden').eq('barrio_id', profile.barrio_id).order('orden'),
    ]);
    if (ts) setTerminales(ts);
    if (gs) setGates(gs);
    setLoading(false);
  }, [profile?.barrio_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const crearTerminal = async () => {
    if (!profile?.barrio_id || !nombreTerminal.trim()) return;
    await supabase.from('terminales').insert({ barrio_id: profile.barrio_id, nombre: nombreTerminal.trim() });
    setNombreTerminal('');
    setShowNuevaTerminal(false);
    cargar();
  };

  const eliminarTerminal = (id: string) => {
    Alert.alert('Eliminar terminal', '¿Eliminás la terminal y todos sus puntos de acceso?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('terminales').delete().eq('id', id);
        cargar();
      }},
    ]);
  };

  const crearGate = async () => {
    if (!profile?.barrio_id || !showNuevoGate || !gateNombre.trim()) return;
    await supabase.from('puntos_acceso').insert({
      terminal_id: showNuevoGate,
      barrio_id: profile.barrio_id,
      nombre: gateNombre.trim(),
      tipo: gateTipo,
      orden: gates.filter(g => g.terminal_id === showNuevoGate).length,
    });
    setGateNombre('');
    setGateTipo('BOTH');
    setShowNuevoGate(null);
    cargar();
  };

  const eliminarGate = (id: string) => {
    Alert.alert('Eliminar punto de acceso', '¿Eliminás este punto de acceso?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('puntos_acceso').delete().eq('id', id);
        cargar();
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Terminales y Accesos" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Configurá las terminales y sus puntos de acceso (barreras).</Text>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNuevaTerminal(true)}>
          <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
          <Text style={styles.addBtnText}>Nueva Terminal</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 32 }} />
        ) : terminales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🖥️</Text>
            <Text style={styles.emptyText}>Sin terminales configuradas</Text>
            <Text style={styles.emptyDesc}>Cada terminal es una PC, tablet o celular que controla una o más barreras.</Text>
          </View>
        ) : (
          terminales.map(terminal => {
            const termGates = gates.filter(g => g.terminal_id === terminal.id);
            const isOpen = expandida === terminal.id;
            return (
              <View key={terminal.id} style={styles.terminalCard}>
                <TouchableOpacity style={styles.terminalHeader} onPress={() => setExpandida(isOpen ? null : terminal.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.terminalNombre}>🖥️ {terminal.nombre}</Text>
                    <Text style={styles.terminalSub}>{termGates.length} punto{termGates.length !== 1 ? 's' : ''} de acceso</Text>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#475569" />
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.terminalBody}>
                    {termGates.map(gate => (
                      <View key={gate.id} style={styles.gateRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.gateNombre}>{gate.nombre}</Text>
                          <Text style={styles.gateTipo}>{TIPO_LABELS[gate.tipo]}</Text>
                        </View>
                        <TouchableOpacity onPress={() => eliminarGate(gate.id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity style={styles.addGateBtn} onPress={() => { setGateNombre(''); setGateTipo('BOTH'); setShowNuevoGate(terminal.id); }}>
                      <Ionicons name="add" size={16} color="#3b82f6" />
                      <Text style={styles.addGateBtnText}>Agregar punto de acceso</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteTerminalBtn} onPress={() => eliminarTerminal(terminal.id)}>
                      <Text style={styles.deleteTerminalText}>Eliminar terminal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal nueva terminal */}
      <Modal visible={showNuevaTerminal} transparent animationType="fade" onRequestClose={() => setShowNuevaTerminal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva Terminal</Text>
            <TextInput
              style={styles.input}
              placeholder='Ej: "Terminal Norte"'
              placeholderTextColor="#475569"
              value={nombreTerminal}
              onChangeText={setNombreTerminal}
              autoFocus
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={crearTerminal}>
              <Text style={styles.confirmBtnText}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNuevaTerminal(false)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal nuevo gate */}
      <Modal visible={!!showNuevoGate} transparent animationType="fade" onRequestClose={() => setShowNuevoGate(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo Punto de Acceso</Text>
            <TextInput
              style={styles.input}
              placeholder='Ej: "Entrada 1"'
              placeholderTextColor="#475569"
              value={gateNombre}
              onChangeText={setGateNombre}
              autoFocus
            />
            <Text style={styles.labelText}>Tipo de acceso</Text>
            {(['IN', 'OUT', 'BOTH'] as const).map(tipo => (
              <TouchableOpacity
                key={tipo}
                style={[styles.tipoOption, gateTipo === tipo && styles.tipoOptionActive]}
                onPress={() => setGateTipo(tipo)}
              >
                <Text style={[styles.tipoOptionText, gateTipo === tipo && styles.tipoOptionTextActive]}>
                  {TIPO_LABELS[tipo]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.confirmBtn, { marginTop: 16 }]} onPress={crearGate}>
              <Text style={styles.confirmBtnText}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNuevoGate(null)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 16 },
  addBtnText: { color: '#3b82f6', fontWeight: '600', fontSize: 15 },
  emptyCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 32, alignItems: 'center' },
  emptyText: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 6 },
  emptyDesc: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  terminalCard: { backgroundColor: '#1e293b', borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  terminalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  terminalNombre: { color: '#fff', fontWeight: '700', fontSize: 15 },
  terminalSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  terminalBody: { padding: 12, paddingTop: 0 },
  gateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8 },
  gateNombre: { color: '#fff', fontWeight: '600', fontSize: 14 },
  gateTipo: { color: '#64748b', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
  addGateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderWidth: 1, borderColor: '#334155', borderRadius: 10, marginBottom: 8 },
  addGateBtnText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  deleteTerminalBtn: { padding: 10, alignItems: 'center' },
  deleteTerminalText: { color: '#ef4444', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 18, padding: 24, width: '100%' },
  modalTitle: { color: '#fff', fontWeight: '700', fontSize: 18, marginBottom: 16 },
  input: { backgroundColor: '#0f172a', color: '#fff', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  labelText: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  tipoOption: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 8 },
  tipoOptionActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a5f' },
  tipoOptionText: { color: '#94a3b8', fontSize: 14 },
  tipoOptionTextActive: { color: '#fff', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 14 },
});
