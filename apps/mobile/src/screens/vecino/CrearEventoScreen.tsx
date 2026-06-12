import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { eventosApi, contactosApi, Contacto } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppHeader } from '../../components/AppHeader';

type InvitadoTemp = {
  nombre: string;
  dni: string;
  tipo: 'manual' | 'contacto';
  contacto_id?: string;
};

export function CrearEventoScreen() {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaDate, setFechaDate] = useState<Date | null>(null);
  const [horaDate, setHoraDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [invitados, setInvitados] = useState<InvitadoTemp[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [showContactos, setShowContactos] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const { space } = useAuthStore();
  const navigation = useNavigation<any>();

  const fetchContactos = async () => {
    setContactosLoading(true);
    try {
      const { contactos: data } = await contactosApi.listar();
      setContactos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      setContactos([]);
    } finally {
      setContactosLoading(false);
    }
  };

  const abrirContactos = () => {
    fetchContactos();
    // Pre-select already added contacts
    const ids = new Set(invitados.filter(i => i.contacto_id).map(i => i.contacto_id!));
    setSelectedContactIds(ids);
    setShowContactos(true);
  };

  const toggleContacto = (contacto: Contacto) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contacto.id)) {
        next.delete(contacto.id);
      } else {
        next.add(contacto.id);
      }
      return next;
    });
  };

  const confirmarContactos = () => {
    // Remove previously added contacts that are no longer selected
    const manuales = invitados.filter(i => i.tipo === 'manual');
    // Add newly selected contacts
    const nuevos: InvitadoTemp[] = contactos
      .filter(c => selectedContactIds.has(c.id))
      .map(c => ({
        nombre: c.nombre,
        dni: c.dni || '',
        tipo: 'contacto' as const,
        contacto_id: c.id,
      }));
    setInvitados([...manuales, ...nuevos]);
    setShowContactos(false);
  };

  const agregarInvitado = () => {
    if (!nuevoNombre.trim()) {
      Alert.alert('Error', 'Ingresá el nombre del invitado');
      return;
    }
    if (!nuevoDni.trim()) {
      Alert.alert('Error', 'Ingresá el DNI del invitado');
      return;
    }
    if (invitados.some((i) => i.dni === nuevoDni.trim())) {
      Alert.alert('Error', 'Ya existe un invitado con ese DNI');
      return;
    }

    setInvitados([...invitados, { nombre: nuevoNombre.trim(), dni: nuevoDni.trim(), tipo: 'manual' }]);
    setNuevoNombre('');
    setNuevoDni('');
  };

  const eliminarInvitado = (index: number) => {
    setInvitados(invitados.filter((_, i) => i !== index));
  };

  const onFechaChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setFechaDate(selectedDate);
  };

  const onHoraChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) setHoraDate(selectedDate);
  };

  const formatFecha = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatHora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const crearEvento = async () => {
    if (!nombre.trim()) {
      Alert.alert('Error', 'Ingresá el nombre del evento');
      return;
    }
    if (!fechaDate) {
      Alert.alert('Error', 'Seleccioná la fecha del evento');
      return;
    }
    if (!horaDate) {
      Alert.alert('Error', 'Seleccioná la hora del evento');
      return;
    }
    if (!space?.id) return;

    // Combinar fecha + hora
    const fechaFinal = new Date(fechaDate);
    fechaFinal.setHours(horaDate.getHours(), horaDate.getMinutes(), 0, 0);

    setGuardando(true);
    try {
      const { event } = await eventosApi.crear({
        spaceId: space.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        fechaEvento: fechaFinal.toISOString(),
        invitados: invitados.map((inv) => ({ nombre: inv.nombre, dni: inv.dni, tipo: inv.tipo })),
      });

      const msg = invitados.length > 0
        ? `Se crearon ${invitados.length} invitaciones con QR único. Podés compartirlas o generar un link público.`
        : 'Evento creado. Generá un link público para que los invitados se registren.';

      Alert.alert(
        '¡Evento creado!',
        msg,
        [
          {
            text: 'Ver evento',
            onPress: () => {
              navigation.replace('DetalleEvento', { eventoId: event.id });
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear el evento');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader 
        title="Crear Evento" 
        showBack 
        onBackPress={() => navigation.goBack()} 
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Invitá a varias personas con QR individual</Text>

        {/* Datos del evento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Datos del evento</Text>

          <Text style={styles.label}>Nombre del evento *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Cumpleaños de Juan"
            placeholderTextColor="#64748b"
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Detalles del evento..."
            placeholderTextColor="#64748b"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />

          <View>
            <Text style={styles.label}>Fecha *</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={18} color="#94a3b8" />
              <Text style={[styles.pickerBtnText, fechaDate && { color: '#fff' }]}>
                {fechaDate ? formatFecha(fechaDate) : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Hora *</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time" size={18} color="#94a3b8" />
              <Text style={[styles.pickerBtnText, horaDate && { color: '#fff' }]}>
                {horaDate ? formatHora(horaDate) : 'Seleccionar hora'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={fechaDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onFechaChange}
              minimumDate={new Date()}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={horaDate || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onHoraChange}
              is24Hour={true}
            />
          )}
        </View>

        {/* Agregar invitados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Invitados ({invitados.length})</Text>
          <Text style={styles.hint}>Podés agregar invitados ahora o después con el link público</Text>

          <View style={styles.addModeRow}>
            <TouchableOpacity style={styles.addModeBtn} onPress={abrirContactos}>
              <Ionicons name="people" size={20} color="#3b82f6" />
              <Text style={styles.addModeBtnText}>Desde contactos</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addInvitadoBox}>
            <Text style={styles.addBoxTitle}>Agregar manualmente</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del invitado"
              placeholderTextColor="#64748b"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="DNI del invitado"
              placeholderTextColor="#64748b"
              value={nuevoDni}
              onChangeText={setNuevoDni}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.addBtn} onPress={agregarInvitado}>
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {invitados.map((inv, index) => (
            <View key={index} style={styles.invitadoItem}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.invNombre}>{inv.nombre}</Text>
                  <View style={[styles.tipoBadge, inv.tipo === 'contacto' ? { backgroundColor: '#1e40af' } : { backgroundColor: '#334155' }]}>
                    <Text style={styles.tipoBadgeText}>{inv.tipo === 'contacto' ? 'Contacto' : 'Manual'}</Text>
                  </View>
                </View>
                {inv.dni ? <Text style={styles.invDni}>DNI: {inv.dni}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => eliminarInvitado(index)}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Info link público */}
        <View style={styles.linkInfoBox}>
          <Ionicons name="link" size={20} color="#3b82f6" />
          <Text style={styles.linkInfoText}>
            Después de crear el evento, podés generar un link público para que los invitados se registren solos.
          </Text>
        </View>

        {/* Botón crear */}
        <TouchableOpacity
          style={[styles.crearBtn, guardando && { opacity: 0.5 }]}
          onPress={crearEvento}
          disabled={guardando}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.crearBtnText}>
            {guardando
              ? 'Creando...'
              : invitados.length > 0
                ? `Crear evento con ${invitados.length} invitado${invitados.length !== 1 ? 's' : ''}`
                : 'Crear evento'
            }
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal seleccionar contactos */}
      <Modal visible={showContactos} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar contactos</Text>
            {contactosLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 24 }} />
            ) : contactos.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ color: '#94a3b8', fontSize: 15 }}>No tenés contactos guardados</Text>
                <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Crealos desde la sección Contactos</Text>
              </View>
            ) : (
              <FlatList
                data={contactos}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => {
                  const selected = selectedContactIds.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.contactoRow, selected && styles.contactoRowSelected]}
                      onPress={() => toggleContacto(item)}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactoNombre}>{item.nombre}</Text>
                        <Text style={styles.contactoDetalle}>
                          {[item.dni && `DNI: ${item.dni}`, item.telefono].filter(Boolean).join(' • ') || 'Sin datos adicionales'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#334155', flex: 1 }]}
                onPress={() => setShowContactos(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#3b82f6', flex: 1 }]}
                onPress={confirmarContactos}
              >
                <Text style={styles.modalBtnText}>Agregar ({selectedContactIds.size})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4, marginBottom: 24 },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  row: { flexDirection: 'row' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 8,
  },
  pickerBtnText: { fontSize: 15, color: '#64748b' },
  addModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  addModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e40af',
    justifyContent: 'center',
  },
  addModeBtnText: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },
  addInvitadoBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 12,
  },
  addBoxTitle: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  invitadoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  invNombre: { fontSize: 15, fontWeight: '600', color: '#fff' },
  invDni: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tipoBadgeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  linkInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  linkInfoText: { flex: 1, fontSize: 13, color: '#93c5fd', lineHeight: 18 },
  crearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  crearBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  contactoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  contactoRowSelected: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  contactoNombre: { fontSize: 15, fontWeight: '600', color: '#fff' },
  contactoDetalle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
