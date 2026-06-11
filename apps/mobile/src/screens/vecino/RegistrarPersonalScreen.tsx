import React, { useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { nanoid } from 'nanoid/non-secure';

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
  const { profile } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [horariosPorDia, setHorariosPorDia] = useState<Record<number, HorarioDia>>({});
  const [loading, setLoading] = useState(false);
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [personalExistente, setPersonalExistente] = useState<any>(null);
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

  const buscarPorDni = async () => {
    if (!dni.trim() || !profile?.barrio_id) return;
    setBuscandoDni(true);

    const { data, error } = await supabase
      .from('personal_permanente')
      .select('*')
      .eq('dni', dni.trim())
      .eq('barrio_id', profile.barrio_id)
      .eq('activo', true)
      .maybeSingle();

    if (!error && data) {
      setPersonalExistente(data);
      setNombre(data.nombre);
      setTelefono(data.telefono || '');
      if (data.foto_url) setFotoUri(data.foto_url);

      // Verificar si ya está vinculado a este vecino
      const { data: permiso } = await supabase
        .from('permisos_horarios')
        .select('id')
        .eq('personal_id', data.id)
        .eq('vecino_id', profile.id)
        .eq('activo', true)
        .limit(1);

      if (permiso && permiso.length > 0) {
        const msg = `${data.nombre} ya está registrado y vinculado a tu casa. Podés ver sus detalles desde la lista.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Ya vinculado', msg);
        }
        setBuscandoDni(false);
        return;
      }

      const msg = `${data.nombre} ya está registrado en el barrio. Solo se crearán los horarios para tu casa.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Personal encontrado', msg);
      }
    } else {
      setPersonalExistente(null);
    }

    setBuscandoDni(false);
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
    }
  };

  const subirFoto = async (personalId: string): Promise<string | null> => {
    if (!fotoUri || fotoUri.startsWith('http')) return fotoUri;
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
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('fotos-personal')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Error procesando foto:', err);
      return null;
    }
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
    if (!profile?.id || !profile?.barrio_id) return;

    setLoading(true);

    try {
      let personalId: string;

      if (personalExistente) {
        personalId = personalExistente.id;
      } else {
        const qrCode = `PERS-${nanoid(12)}`;

        const { data: nuevoPersonal, error: insertError } = await supabase
          .from('personal_permanente')
          .insert({
            barrio_id: profile.barrio_id,
            nombre: nombre.trim(),
            dni: dni.trim(),
            telefono: telefono.trim() || null,
            qr_code: qrCode,
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            Alert.alert('DNI duplicado', 'Ya existe una persona con este DNI. Presioná "Buscar" para vincularla.');
            setLoading(false);
            return;
          }
          throw insertError;
        }

        personalId = nuevoPersonal.id;

        // Subir foto
        const fotoUrl = await subirFoto(personalId);
        if (fotoUrl) {
          await supabase
            .from('personal_permanente')
            .update({ foto_url: fotoUrl })
            .eq('id', personalId);
        }
      }

      // Crear permisos horarios (cada día con su propio horario)
      const permisos = diasSeleccionados.map((dia) => ({
        personal_id: personalId,
        vecino_id: profile.id,
        dia_semana: dia,
        hora_entrada: horariosPorDia[dia].entrada,
        hora_salida: horariosPorDia[dia].salida,
      }));

      const { error: permError } = await supabase
        .from('permisos_horarios')
        .insert(permisos);

      if (permError) throw permError;

      const msg = personalExistente
        ? `${nombre} fue vinculado a tu casa con los horarios configurados.`
        : `${nombre} fue registrado exitosamente.`;

      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Listo', msg);
      }

      navigation.goBack();
    } catch (error: any) {
      console.error('Error registrando personal:', error);
      Alert.alert('Error', 'No se pudo registrar el personal. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const formatHora = (h: string) => h.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* DNI con búsqueda */}
      <View style={styles.section}>
        <Text style={styles.label}>DNI *</Text>
        <View style={styles.dniRow}>
          <TextInput
            style={[styles.input, styles.dniInput]}
            value={dni}
            onChangeText={setDni}
            placeholder="Ej: 30123456"
            placeholderTextColor="#475569"
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.dniSearchBtn} onPress={buscarPorDni} disabled={buscandoDni}>
            {buscandoDni ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Buscá por DNI para verificar si ya está registrado</Text>
      </View>

      {personalExistente && (
        <View style={styles.existenteBox}>
          <Ionicons name="information-circle" size={20} color="#38bdf8" />
          <Text style={styles.existenteText}>
            Ya registrado en el barrio. Solo se crearán horarios para tu casa.
          </Text>
        </View>
      )}

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
          editable={!personalExistente}
        />
      </View>

      {/* Foto */}
      {!personalExistente && (
        <View style={styles.section}>
          <Text style={styles.label}>Foto</Text>
          {fotoUri ? (
            <View style={styles.fotoContainer}>
              <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
              <TouchableOpacity style={styles.fotoRemove} onPress={() => setFotoUri(null)}>
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </TouchableOpacity>
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
      )}

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
            <Text style={styles.registerBtnText}>
              {personalExistente ? 'Vincular a mi casa' : 'Registrar Personal'}
            </Text>
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
