import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contactosApi, invitacionesApi, Contacto } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

type DuracionOption = {
  label: string;
  horas: number;
};

const DURACIONES: DuracionOption[] = [
  { label: '1 hora', horas: 1 },
  { label: '4 horas', horas: 4 },
  { label: 'Hoy', horas: 12 },
  { label: '24 horas', horas: 24 },
  { label: '1 semana', horas: 168 },
];

export function CrearInvitacionScreen({ navigation }: any) {
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [patente, setPatente] = useState('');
  const [duracion, setDuracion] = useState<DuracionOption>(DURACIONES[2]);
  const [usos, setUsos] = useState(1);
  const [loading, setLoading] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [showContactos, setShowContactos] = useState(false);
  const [guardarContacto, setGuardarContacto] = useState(false);
  const { profile, space } = useAuthStore();

  useEffect(() => {
    fetchContactos();
  }, []);

  const fetchContactos = async () => {
    try {
      const { contactos: data } = await contactosApi.listar();
      setContactos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      // silently ignore
    }
  };

  const seleccionarContacto = (contacto: Contacto) => {
    setNombre(contacto.nombre);
    setDni(contacto.dni || '');
    setTelefono(contacto.telefono || '');
    setPatente(contacto.patente || '');
    setShowContactos(false);
  };

  const crearInvitacion = async () => {
    const nombreTrimmed = nombre.trim();
    if (!nombreTrimmed) {
      Alert.alert('Error', 'El nombre del invitado es obligatorio');
      return;
    }
    if (!space?.id) {
      Alert.alert('Error', 'No hay espacio activo');
      return;
    }

    setLoading(true);
    try {
      if (guardarContacto && !contactos.find(c => c.nombre === nombreTrimmed)) {
        await contactosApi.crear({
          nombre: nombreTrimmed,
          dni: dni.trim() || undefined,
          telefono: telefono.trim() || undefined,
          patente: patente.trim().toUpperCase() || undefined,
        });
      }

      const { invitacion } = await invitacionesApi.crear({
        spaceId: space.id,
        nombre: nombreTrimmed,
        dni: dni.trim() || undefined,
        telefono: telefono.trim() || undefined,
        patente: patente.trim().toUpperCase() || undefined,
        usosMaximos: usos,
        horasVigencia: duracion.horas,
      });

      Alert.alert(
        '¡Invitación creada!',
        'Ya podés compartir el QR con tu invitado',
        [{ text: 'Ver QR', onPress: () => navigation.navigate('DetalleInvitacion', { invitacion }) }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'No se pudo crear la invitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nueva Invitación</Text>

      {contactos.length > 0 && (
        <TouchableOpacity
          style={styles.contactosButton}
          onPress={() => setShowContactos(true)}
        >
          <Ionicons name="book-outline" size={18} color="#3b82f6" />
          <Text style={styles.contactosButtonText}>Elegir de mis contactos</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Nombre del invitado *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Juan Pérez"
          placeholderTextColor="#666"
          value={nombre}
          onChangeText={setNombre}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>DNI (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="12345678"
          placeholderTextColor="#666"
          value={dni}
          onChangeText={setDni}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Teléfono (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="11 1234-5678"
          placeholderTextColor="#666"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Patente (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="ABC 123"
          placeholderTextColor="#666"
          value={patente}
          onChangeText={setPatente}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Válido por</Text>
        <View style={styles.duracionContainer}>
          {DURACIONES.map((d) => (
            <TouchableOpacity
              key={d.horas}
              style={[
                styles.duracionOption,
                duracion.horas === d.horas && styles.duracionSelected,
              ]}
              onPress={() => setDuracion(d)}
            >
              <Text
                style={[
                  styles.duracionText,
                  duracion.horas === d.horas && styles.duracionTextSelected,
                ]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Cantidad de ingresos permitidos</Text>
        <View style={styles.usosContainer}>
          {[1, 2, 5, 10].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.usosOption, usos === n && styles.usosSelected]}
              onPress={() => setUsos(n)}
            >
              <Text style={[styles.usosText, usos === n && styles.usosTextSelected]}>
                {n === 10 ? '∞' : n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.guardarContactoButton}
        onPress={() => setGuardarContacto(!guardarContacto)}
      >
        <View style={[styles.checkbox, guardarContacto && styles.checkboxChecked]}>
          {guardarContacto && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <Text style={styles.guardarContactoText}>
          Guardar en mis contactos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.createButton, loading && styles.createButtonDisabled]}
        onPress={crearInvitacion}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.createButtonText}>Crear Invitación</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Modal de contactos */}
      <Modal
        visible={showContactos}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowContactos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mis Contactos</Text>
            
            <FlatList
              data={contactos}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactoItem}
                  onPress={() => seleccionarContacto(item)}
                >
                  <Text style={styles.contactoNombre}>{item.nombre}</Text>
                  {item.notas && (
                    <Text style={styles.contactoNotas}>{item.notas}</Text>
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowContactos(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
  },
  contactosButton: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  contactosButtonText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
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
  duracionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  duracionOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  duracionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  duracionText: {
    color: '#64748b',
    fontSize: 14,
  },
  duracionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  usosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  usosOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  usosSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  usosText: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '600',
  },
  usosTextSelected: {
    color: '#fff',
  },
  guardarContactoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  guardarContactoText: {
    color: '#f1f5f9',
    fontSize: 15,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
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
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
    textAlign: 'center',
  },
  contactoItem: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  contactoNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  contactoNotas: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  closeButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
  fotoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fotoButton: {
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
  fotoButtonText: {
    color: '#64748b',
    fontSize: 13,
  },
  fotoPreviewContainer: {
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
  fotoRemoveButton: {
    position: 'absolute',
    top: 0,
    right: '28%',
  },
});
