import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contactosApi, Contacto } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export function ContactosScreen() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [patente, setPatente] = useState('');
  const [notas, setNotas] = useState('');
  const { profile } = useAuthStore();

  const fetchContactos = async () => {
    try {
      const { contactos: data } = await contactosApi.listar();
      setContactos(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchContactos();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContactos();
    setRefreshing(false);
  };

  const resetForm = () => {
    setNombre('');
    setDni('');
    setTelefono('');
    setPatente('');
    setNotas('');
    setEditingContacto(null);
  };

  const openEdit = (contacto: Contacto) => {
    setEditingContacto(contacto);
    setNombre(contacto.nombre);
    setDni(contacto.dni || '');
    setTelefono(contacto.telefono || '');
    setPatente(contacto.patente || '');
    setNotas(contacto.notas || '');
    setShowModal(true);
  };

  const guardarContacto = async () => {
    if (!nombre.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    const datos = {
      nombre: nombre.trim(),
      dni: dni.trim() || undefined,
      telefono: telefono.trim() || undefined,
      patente: patente.trim().toUpperCase() || undefined,
      notas: notas.trim() || undefined,
    };

    try {
      if (editingContacto) {
        await contactosApi.actualizar(editingContacto.id, datos);
      } else {
        await contactosApi.crear(datos);
      }
      setShowModal(false);
      resetForm();
      fetchContactos();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo guardar el contacto');
    }
  };

  const eliminarContacto = (contacto: Contacto) => {
    Alert.alert(
      'Eliminar contacto',
      `¿Eliminar a ${contacto.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try { await contactosApi.eliminar(contacto.id); } catch {}
            fetchContactos();
          },
        },
      ]
    );
  };

  const renderContacto = ({ item }: { item: Contacto }) => (
    <TouchableOpacity
      style={styles.contactoCard}
      onPress={() => openEdit(item)}
      onLongPress={() => eliminarContacto(item)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.nombre.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactoInfo}>
        <Text style={styles.contactoNombre} numberOfLines={1}>{item.nombre}</Text>
        {item.notas && <Text style={styles.contactoNotas} numberOfLines={2}>{item.notas}</Text>}
        <View style={styles.tags}>
          {item.dni && <Text style={styles.tag}>DNI: {item.dni}</Text>}
          {item.patente && <Text style={styles.tag}>{item.patente}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Contactos</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={contactos}
        keyExtractor={(item) => item.id}
        renderItem={renderContacto}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color="#334155" />
            <Text style={styles.emptyText}>No tenés contactos guardados</Text>
            <Text style={styles.emptySubtext}>
              Agregá contactos para crear invitaciones más rápido
            </Text>
          </View>
        }
      />

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              placeholderTextColor="#666"
              value={nombre}
              onChangeText={setNombre}
            />

            <TextInput
              style={styles.input}
              placeholder="DNI"
              placeholderTextColor="#666"
              value={dni}
              onChangeText={setDni}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              placeholderTextColor="#666"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Patente"
              placeholderTextColor="#666"
              value={patente}
              onChangeText={setPatente}
              autoCapitalize="characters"
            />

            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Notas (ej: jardinero, delivery)"
              placeholderTextColor="#666"
              value={notas}
              onChangeText={setNotas}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} onPress={guardarContacto}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  contactoInfo: {
    flex: 1,
  },
  contactoNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  contactoNotas: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    color: '#64748b',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 10,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
});
