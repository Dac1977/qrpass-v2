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
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, Contacto } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { nanoid } from 'nanoid/non-secure';

const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

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
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const { profile } = useAuthStore();

  useEffect(() => {
    fetchContactos();
  }, []);

  const fetchContactos = async () => {
    const { data } = await supabase
      .from('contactos')
      .select('*')
      .eq('vecino_id', profile?.id)
      .order('nombre');

    if (data) setContactos(data);
  };

  const elegirFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería para seleccionar una foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar una foto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const subirFoto = async (userId: string, invitacionId: string): Promise<string | null> => {
    if (!fotoUri) return null;
    try {
      const response = await fetch(fotoUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const fileExt = 'jpg';
      const filePath = `${userId}/${invitacionId}.${fileExt}`;

      const { error } = await supabase.storage
        .from('fotos-invitados')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Error subiendo foto:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('fotos-invitados')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Error procesando foto:', err);
      return null;
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

    setLoading(true);

    try {
      const userId = await getUserId();
      
      if (!userId) {
        Alert.alert('Error', 'No se pudo obtener tu sesión. Intentá cerrar sesión y volver a entrar.');
        setLoading(false);
        return;
      }

      const qrCode = nanoid(16);
      const validoHasta = new Date();
      validoHasta.setHours(validoHasta.getHours() + duracion.horas);
      
      console.log('Creando invitación con:', {
        vecino_id: userId,
        nombre_invitado: nombreTrimmed,
        qr_code: qrCode,
        valido_hasta: validoHasta.toISOString(),
      });

      // Si debe guardar contacto, primero lo guarda
      let contactoId = null;
      if (guardarContacto && !contactos.find(c => c.nombre === nombre)) {
        const { data: nuevoContacto } = await supabase
          .from('contactos')
          .insert({
            vecino_id: userId,
            nombre: nombre.trim(),
            dni: dni.trim() || null,
            telefono: telefono.trim() || null,
            patente: patente.trim().toUpperCase() || null,
          })
          .select()
          .single();

        contactoId = nuevoContacto?.id;
      }

      const { data: invitacion, error } = await supabase
        .from('invitaciones')
        .insert({
          vecino_id: userId,
          contacto_id: contactoId,
          nombre_invitado: nombre.trim(),
          dni_invitado: dni.trim() || null,
          telefono_invitado: telefono.trim() || null,
          patente: patente.trim().toUpperCase() || null,
          qr_code: qrCode,
          valido_hasta: validoHasta.toISOString(),
          usos_permitidos: usos,
        })
        .select()
        .single();

      console.log('Invitacion creada:', { invitacion, error });

      if (error) throw error;

      // Subir foto si existe
      if (fotoUri && invitacion) {
        const fotoUrl = await subirFoto(userId, invitacion.id);
        if (fotoUrl) {
          await supabase
            .from('invitaciones')
            .update({ foto_invitado_url: fotoUrl })
            .eq('id', invitacion.id);
          invitacion.foto_invitado_url = fotoUrl;
        }
      }

      Alert.alert(
        '¡Invitación creada!',
        'Ya podés compartir el QR con tu invitado',
        [{ text: 'Ver QR', onPress: () => navigation.navigate('DetalleInvitacion', { invitacion }) }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
        <Text style={styles.label}>Foto del invitado (opcional)</Text>
        {fotoUri ? (
          <View style={styles.fotoPreviewContainer}>
            <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
            <TouchableOpacity style={styles.fotoRemoveButton} onPress={() => setFotoUri(null)}>
              <Ionicons name="close-circle" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.fotoButtonsRow}>
            <TouchableOpacity style={styles.fotoButton} onPress={elegirFoto}>
              <Ionicons name="images-outline" size={28} color="#38bdf8" />
              <Text style={styles.fotoButtonText}>Galería</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.fotoButton} onPress={tomarFoto}>
                <Ionicons name="camera-outline" size={28} color="#38bdf8" />
                <Text style={styles.fotoButtonText}>Cámara</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
