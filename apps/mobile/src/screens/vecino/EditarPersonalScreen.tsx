import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, PersonalPermanente, PermisoHorario } from '../../lib/supabase';
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

export function EditarPersonalScreen({ route, navigation }: any) {
  const { personalId } = route.params;
  const { profile } = useAuthStore();

  const [personal, setPersonal] = useState<PersonalPermanente | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Datos editables del personal
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoChanged, setFotoChanged] = useState(false);

  // Horarios por día
  const [horariosPorDia, setHorariosPorDia] = useState<Record<number, HorarioDia>>({});
  const [timePicker, setTimePicker] = useState<{ dia: number; campo: 'entrada' | 'salida' } | null>(null);

  useEffect(() => {
    fetchData();
  }, [personalId]);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: personalData }, { data: horariosData }] = await Promise.all([
      supabase
        .from('personal_permanente')
        .select('*')
        .eq('id', personalId)
        .single(),
      supabase
        .from('permisos_horarios')
        .select('*')
        .eq('personal_id', personalId)
        .eq('vecino_id', profile?.id)
        .eq('activo', true)
        .order('dia_semana'),
    ]);

    if (personalData) {
      const p = personalData as PersonalPermanente;
      setPersonal(p);
      setNombre(p.nombre);
      setTelefono(p.telefono || '');
      setFotoUri(p.foto_url || null);
    }

    if (horariosData && horariosData.length > 0) {
      const h = horariosData as PermisoHorario[];
      const map: Record<number, HorarioDia> = {};
      h.forEach((x) => {
        map[x.dia_semana] = {
          entrada: x.hora_entrada || '08:00:00',
          salida: x.hora_salida || '17:00:00',
        };
      });
      setHorariosPorDia(map);
    }

    setLoading(false);
  };

  const toggleDia = (dia: number) => {
    setHorariosPorDia((prev) => {
      if (prev[dia]) {
        const next = { ...prev };
        delete next[dia];
        return next;
      }
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

  const elegirFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
      setFotoChanged(true);
    }
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
      setFotoChanged(true);
    }
  };

  const subirFoto = async (): Promise<string | null> => {
    if (!fotoUri || !fotoChanged) return fotoUri;
    if (fotoUri.startsWith('http')) return fotoUri;

    try {
      const response = await fetch(fotoUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const filePath = `${profile?.barrio_id}/${personalId}.jpg`;

      const { error } = await supabase.storage
        .from('fotos-personal')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Error subiendo foto:', error);
        return personal?.foto_url || null;
      }

      const { data: urlData } = supabase.storage
        .from('fotos-personal')
        .getPublicUrl(filePath);

      return urlData.publicUrl + '?t=' + Date.now();
    } catch (err) {
      console.error('Error procesando foto:', err);
      return personal?.foto_url || null;
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Datos requeridos', 'El nombre es obligatorio.');
      return;
    }
    const diasSeleccionados = Object.keys(horariosPorDia).map(Number);
    if (diasSeleccionados.length === 0) {
      Alert.alert('Horarios requeridos', 'Seleccioná al menos un día de la semana.');
      return;
    }
    if (!profile?.id || !personal) return;

    setSaving(true);

    try {
      // 1. Actualizar datos del personal
      const updateData: any = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
      };

      if (fotoChanged) {
        const nuevaFotoUrl = await subirFoto();
        if (nuevaFotoUrl) {
          updateData.foto_url = nuevaFotoUrl;
        }
      }

      const { error: updateError } = await supabase
        .from('personal_permanente')
        .update(updateData)
        .eq('id', personalId);

      if (updateError) throw updateError;

      // 2. Eliminar horarios actuales y crear nuevos
      const { error: deleteError } = await supabase
        .from('permisos_horarios')
        .delete()
        .eq('personal_id', personalId)
        .eq('vecino_id', profile.id);

      if (deleteError) throw deleteError;

      const nuevosPermisos = diasSeleccionados.map((dia) => ({
        personal_id: personalId,
        vecino_id: profile.id,
        dia_semana: dia,
        hora_entrada: horariosPorDia[dia].entrada,
        hora_salida: horariosPorDia[dia].salida,
      }));

      const { error: insertError } = await supabase
        .from('permisos_horarios')
        .insert(nuevosPermisos);

      if (insertError) throw insertError;

      const msg = 'Los datos y horarios se actualizaron correctamente.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Listo', msg);
      }

      navigation.goBack();
    } catch (error: any) {
      console.error('Error guardando cambios:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const formatHora = (h: string) => h?.slice(0, 5) || '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!personal) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se encontró el personal</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Foto */}
      <View style={styles.section}>
        <Text style={styles.label}>Foto</Text>
        {fotoUri ? (
          <View style={styles.fotoContainer}>
            <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
            <View style={styles.fotoActions}>
              <TouchableOpacity style={styles.fotoActionBtn} onPress={elegirFoto}>
                <Ionicons name="images-outline" size={18} color="#38bdf8" />
                <Text style={styles.fotoActionText}>Cambiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fotoActionBtn} onPress={() => { setFotoUri(null); setFotoChanged(true); }}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={[styles.fotoActionText, { color: '#ef4444' }]}>Quitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.fotoButtons}>
            <TouchableOpacity style={styles.fotoBtn} onPress={elegirFoto}>
              <Ionicons name="images-outline" size={28} color="#38bdf8" />
              <Text style={styles.fotoBtnText}>Galería</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto}>
                <Ionicons name="camera-outline" size={28} color="#38bdf8" />
                <Text style={styles.fotoBtnText}>Cámara</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Nombre */}
      <View style={styles.section}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Nombre y apellido"
          placeholderTextColor="#475569"
        />
      </View>

      {/* DNI (solo lectura) */}
      <View style={styles.section}>
        <Text style={styles.label}>DNI</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.disabledText}>{personal.dni}</Text>
        </View>
        <Text style={styles.hint}>El DNI no se puede modificar</Text>
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
        <Text style={styles.label}>Días y horarios</Text>
        <Text style={styles.hint}>Tocá un día para activarlo/desactivarlo, luego ajustá el horario</Text>
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

      {/* Botón guardar */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={guardar}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 16,
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
  inputDisabled: {
    opacity: 0.6,
  },
  disabledText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  fotoContainer: {
    alignItems: 'center',
  },
  fotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  fotoActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  fotoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fotoActionText: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
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
