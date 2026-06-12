import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { personalApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes', short: 'L' },
  { value: 2, label: 'Martes', short: 'M' },
  { value: 3, label: 'Miércoles', short: 'X' },
  { value: 4, label: 'Jueves', short: 'J' },
  { value: 5, label: 'Viernes', short: 'V' },
  { value: 6, label: 'Sábado', short: 'S' },
  { value: 0, label: 'Domingo', short: 'D' },
];

type HorarioDia = { entrada: string; salida: string };

const INTERVALOS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, '0');
  const m = ((i % 4) * 15).toString().padStart(2, '0');
  return { label: `${h}:${m}`, value: `${h}:${m}:00` };
});

export function RegistrarPersonalScreen({ navigation }: any) {
  const { space } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horariosPorDia, setHorariosPorDia] = useState<Record<number, HorarioDia>>({});
  const [loading, setLoading] = useState(false);
  const [timePicker, setTimePicker] = useState<{ dia: number; campo: 'entrada' | 'salida' } | null>(null);

  const toggleDia = (dia: number) => {
    setHorariosPorDia((prev) => {
      if (prev[dia]) {
        const next = { ...prev };
        delete next[dia];
        return next;
      }
      // Default: copy last used times or 08:00-17:00
      const existentes = Object.values(prev);
      const ultimo = existentes.length > 0 ? existentes[existentes.length - 1] : null;
      return {
        ...prev,
        [dia]: {
          entrada: ultimo?.entrada || '08:00:00',
          salida: ultimo?.salida || '17:00:00',
        },
      };
    });
  };

  const setHoraDia = (dia: number, campo: 'entrada' | 'salida', valor: string) => {
    setHorariosPorDia((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: valor },
    }));
  };

  const registrar = async () => {
    if (!nombre.trim() || !dni.trim()) {
      Alert.alert('Datos requeridos', 'Nombre y DNI son obligatorios.');
      return;
    }
    const diasSeleccionados = Object.keys(horariosPorDia).map(Number);
    if (diasSeleccionados.length === 0) {
      Alert.alert('Horarios requeridos', 'Seleccioná al menos un día de la semana.');
      return;
    }
    if (!space?.id) return;

    setLoading(true);
    try {
      const permisos = diasSeleccionados.map((dia) => ({
        diaSemana: dia,
        horaEntrada: horariosPorDia[dia].entrada,
        horaSalida: horariosPorDia[dia].salida,
      }));

      await personalApi.crear({
        spaceId: space.id,
        nombre: nombre.trim(),
        dni: dni.trim(),
        permisos,
      });

      Alert.alert('Listo', `${nombre} fue registrado exitosamente.`);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No se pudo registrar el personal.');
    } finally {
      setLoading(false);
    }
  };

  const formatHora = (h: string) => h.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* DNI */}
      <View style={styles.section}>
        <Text style={styles.label}>DNI *</Text>
        <TextInput
          style={styles.input}
          value={dni}
          onChangeText={setDni}
          placeholder="Ej: 30123456"
          placeholderTextColor="#475569"
          keyboardType="numeric"
        />
      </View>

      {/* Nombre */}
      <View style={styles.section}>
        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Nombre y apellido"
          placeholderTextColor="#475569"
          editable={!personalExistente}
        />
      </View>

      {/* Teléfono */}
      <View style={styles.section}>
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          placeholder="Ej: 1155667788"
          placeholderTextColor="#475569"
          keyboardType="phone-pad"
        />
      </View>


      {/* Días y horarios por día */}
      <View style={styles.section}>
        <Text style={styles.label}>Días y horarios *</Text>
        <Text style={styles.hint}>Tocá un día para activarlo, luego ajustá el horario</Text>
        <View style={styles.diasRow}>
          {DIAS_SEMANA.map((dia) => (
            <TouchableOpacity
              key={dia.value}
              style={[styles.diaChip, horariosPorDia[dia.value] && styles.diaChipActive]}
              onPress={() => toggleDia(dia.value)}
            >
              <Text
                style={[styles.diaChipText, horariosPorDia[dia.value] && styles.diaChipTextActive]}
              >
                {dia.short}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Detalle de horarios por día */}
        {DIAS_SEMANA.filter((d) => horariosPorDia[d.value]).map((dia) => (
          <View key={dia.value} style={styles.diaHorarioCard}>
            <Text style={styles.diaHorarioLabel}>{dia.label}</Text>
            <View style={styles.diaHorasRow}>
              <TouchableOpacity
                style={styles.diaHoraBtn}
                onPress={() => setTimePicker({ dia: dia.value, campo: 'entrada' })}
              >
                <Ionicons name="log-in-outline" size={16} color="#22c55e" />
                <Text style={styles.diaHoraText}>{formatHora(horariosPorDia[dia.value].entrada)}</Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={14} color="#475569" />
              <TouchableOpacity
                style={styles.diaHoraBtn}
                onPress={() => setTimePicker({ dia: dia.value, campo: 'salida' })}
              >
                <Ionicons name="log-out-outline" size={16} color="#f97316" />
                <Text style={styles.diaHoraText}>{formatHora(horariosPorDia[dia.value].salida)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Botón registrar */}
      <TouchableOpacity
        style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
        onPress={registrar}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.registerBtnText}>Registrar Personal</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Modal selector de hora */}
      <Modal visible={timePicker !== null} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTimePicker(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {timePicker?.campo === 'entrada' ? 'Hora de entrada' : 'Hora de salida'}
              {timePicker ? ` - ${DIAS_SEMANA.find((d) => d.value === timePicker.dia)?.label}` : ''}
            </Text>
            <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
              {INTERVALOS.map((item) => {
                const currentValue = timePicker
                  ? (timePicker.campo === 'entrada'
                      ? horariosPorDia[timePicker.dia]?.entrada
                      : horariosPorDia[timePicker.dia]?.salida)
                  : '';
                const isActive = item.value === currentValue;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.horaOption, isActive && styles.horaOptionActive]}
                    onPress={() => {
                      if (timePicker) {
                        setHoraDia(timePicker.dia, timePicker.campo, item.value);
                        setTimePicker(null);
                      }
                    }}
                  >
                    <Text style={[styles.horaOptionText, isActive && styles.horaOptionTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setTimePicker(null)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  dniRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dniInput: {
    flex: 1,
  },
  dniSearchBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  existenteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c4a6e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  existenteText: {
    flex: 1,
    fontSize: 13,
    color: '#7dd3fc',
  },
  fotoContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  fotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  fotoRemove: {
    position: 'absolute',
    top: 0,
    right: '30%',
  },
  fotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  fotoBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    gap: 6,
  },
  fotoBtnText: {
    color: '#64748b',
    fontSize: 13,
  },
  diasRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  diaChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  diaChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  diaChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  diaChipTextActive: {
    color: '#fff',
  },
  diaHorarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  diaHorarioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    width: 90,
  },
  diaHorasRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  diaHoraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  diaHoraText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 10,
  },
  registerBtnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    padding: 20,
  },
  timeList: {
    maxHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 16,
  },
  horaOption: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  horaOptionActive: {
    backgroundColor: '#3b82f6',
  },
  horaOptionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  horaOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalClose: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#64748b',
  },
});
