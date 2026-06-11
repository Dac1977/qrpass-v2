import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { supabase, Reclamo } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIAS = [
  { value: 'mantenimiento', label: '🔧 Mantenimiento', color: '#f59e0b' },
  { value: 'seguridad', label: '🛡️ Seguridad', color: '#ef4444' },
  { value: 'limpieza', label: '🧹 Limpieza', color: '#3b82f6' },
  { value: 'ruidos', label: '🔊 Ruidos', color: '#8b5cf6' },
  { value: 'espacios_comunes', label: '🏠 Espacios comunes', color: '#10b981' },
  { value: 'general', label: '📋 General', color: '#6b7280' },
  { value: 'otro', label: '❓ Otro', color: '#94a3b8' },
];

export function ReclamosScreen() {
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCrear, setShowCrear] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('general');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState<'mis' | 'barrio'>('barrio');
  const { profile } = useAuthStore();

  const fetchReclamos = async () => {
    if (!profile?.barrio_id) return;
    const { data } = await supabase
      .from('reclamos')
      .select('*')
      .eq('barrio_id', profile.barrio_id)
      .order('created_at', { ascending: false });
    if (data) setReclamos(data);
  };

  useFocusEffect(
    useCallback(() => {
      fetchReclamos();
    }, [profile?.barrio_id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReclamos();
    setRefreshing(false);
  };

  const tomarFoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const subirFoto = async (): Promise<string | null> => {
    if (!fotoUri || !profile?.id) return null;

    try {
      const ext = fotoUri.split('.').pop() || 'jpg';
      const fileName = `reclamos/${profile.id}/${Date.now()}.${ext}`;

      const response = await fetch(fotoUri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('reclamos')
        .upload(fileName, blob, { contentType: `image/${ext}` });

      if (error) {
        // Bucket might not exist, try creating
        console.error('Upload error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('reclamos')
        .getPublicUrl(fileName);

      return urlData?.publicUrl || null;
    } catch {
      return null;
    }
  };

  const crearReclamo = async () => {
    if (!titulo.trim() || !descripcion.trim()) {
      Alert.alert('Error', 'Completá título y descripción');
      return;
    }
    if (!profile?.id || !profile?.barrio_id) return;

    setGuardando(true);
    try {
      let fotoUrl: string | null = null;
      if (fotoUri) {
        fotoUrl = await subirFoto();
      }

      const { error } = await supabase.from('reclamos').insert({
        barrio_id: profile.barrio_id,
        vecino_id: profile.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
        foto_url: fotoUrl,
      });

      if (error) throw error;

      setShowCrear(false);
      setTitulo('');
      setDescripcion('');
      setCategoria('general');
      setFotoUri(null);
      fetchReclamos();
      Alert.alert('¡Reclamo enviado!', 'La administración lo revisará pronto.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const getEstadoInfo = (estado: string) => {
    switch (estado) {
      case 'abierto': return { color: '#3b82f6', label: 'Abierto' };
      case 'en_proceso': return { color: '#eab308', label: 'En proceso' };
      case 'resuelto': return { color: '#22c55e', label: 'Resuelto' };
      case 'cerrado': return { color: '#6b7280', label: 'Cerrado' };
      default: return { color: '#6b7280', label: estado };
    }
  };

  const getCategoriaInfo = (cat: string) =>
    CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[5];

  const filteredReclamos = tab === 'mis'
    ? reclamos.filter((r) => r.vecino_id === profile?.id)
    : reclamos;

  const renderReclamo = ({ item }: { item: Reclamo }) => {
    const estadoInfo = getEstadoInfo(item.estado);
    const catInfo = getCategoriaInfo(item.categoria);
    const esMio = item.vecino_id === profile?.id;

    return (
      <View style={styles.reclamoCard}>
        <View style={styles.reclamoHeader}>
          <View style={[styles.catBadge, { backgroundColor: catInfo.color + '20', borderColor: catInfo.color }]}>
            <Text style={[styles.catText, { color: catInfo.color }]}>{catInfo.label}</Text>
          </View>
          <View style={[styles.estadoBadge, { backgroundColor: estadoInfo.color }]}>
            <Text style={styles.estadoText}>{estadoInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.reclamoTitulo}>{item.titulo}</Text>
        <Text style={styles.reclamoDesc} numberOfLines={3}>{item.descripcion}</Text>

        {item.foto_url && (
          <Image source={{ uri: item.foto_url }} style={styles.reclamoFoto} />
        )}

        {item.respuesta_admin && (
          <View style={styles.respuestaBox}>
            <Text style={styles.respuestaLabel}>💬 Respuesta del admin:</Text>
            <Text style={styles.respuestaText}>{item.respuesta_admin}</Text>
          </View>
        )}

        <Text style={styles.reclamoFecha}>
          {esMio ? '📝 Mi reclamo • ' : ''}
          {new Date(item.created_at).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reclamos</Text>
        <TouchableOpacity style={styles.nuevoBtn} onPress={() => setShowCrear(true)}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.nuevoBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'barrio' && styles.tabActivo]}
          onPress={() => setTab('barrio')}
        >
          <Text style={[styles.tabText, tab === 'barrio' && styles.tabTextoActivo]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'mis' && styles.tabActivo]}
          onPress={() => setTab('mis')}
        >
          <Text style={[styles.tabText, tab === 'mis' && styles.tabTextoActivo]}>Mis reclamos</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredReclamos}
        keyExtractor={(item) => item.id}
        renderItem={renderReclamo}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No hay reclamos</Text>
          </View>
        }
      />

      {/* Modal crear reclamo */}
      <Modal visible={showCrear} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nuevo Reclamo</Text>

              <Text style={styles.label}>Categoría</Text>
              <View style={styles.categoriasGrid}>
                {CATEGORIAS.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.catOption, categoria === cat.value && { borderColor: cat.color, backgroundColor: cat.color + '15' }]}
                    onPress={() => setCategoria(cat.value)}
                  >
                    <Text style={[styles.catOptionText, categoria === cat.value && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                placeholder="Resumen del problema"
                placeholderTextColor="#64748b"
                value={titulo}
                onChangeText={setTitulo}
              />

              <Text style={styles.label}>Descripción *</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Detallá el problema..."
                placeholderTextColor="#64748b"
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
              />

              <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto}>
                <Ionicons name="camera" size={20} color="#e94560" />
                <Text style={styles.fotoBtnText}>
                  {fotoUri ? 'Cambiar foto' : 'Agregar foto'}
                </Text>
              </TouchableOpacity>
              {fotoUri && (
                <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
              )}

              <TouchableOpacity
                style={[styles.guardarBtn, guardando && { opacity: 0.5 }]}
                onPress={crearReclamo}
                disabled={guardando}
              >
                <Text style={styles.guardarBtnText}>
                  {guardando ? 'Enviando...' : 'Enviar reclamo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cerrarBtn} onPress={() => setShowCrear(false)}>
                <Text style={styles.cerrarBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  nuevoBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e94560',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 6,
  },
  nuevoBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#16213e', borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActivo: { backgroundColor: '#e94560' },
  tabText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  tabTextoActivo: { color: '#fff' },
  list: { padding: 16 },
  reclamoCard: {
    backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#0f3460',
  },
  reclamoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  catBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  catText: { fontSize: 12, fontWeight: '600' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  estadoText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reclamoTitulo: { fontSize: 16, fontWeight: '700', color: '#fff' },
  reclamoDesc: { fontSize: 14, color: '#94a3b8', marginTop: 6 },
  reclamoFoto: { width: '100%', height: 180, borderRadius: 12, marginTop: 10 },
  respuestaBox: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginTop: 10,
    borderLeftWidth: 3, borderLeftColor: '#3b82f6',
  },
  respuestaLabel: { fontSize: 12, color: '#3b82f6', fontWeight: '600', marginBottom: 4 },
  respuestaText: { fontSize: 14, color: '#e2e8f0' },
  reclamoFecha: { fontSize: 12, color: '#64748b', marginTop: 10 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, fontSize: 16, color: '#fff',
    borderWidth: 1, borderColor: '#0f3460',
  },
  categoriasGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  catOption: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#0f3460',
  },
  catOptionText: { fontSize: 13, color: '#94a3b8' },
  fotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#0f3460',
  },
  fotoBtnText: { color: '#e94560', fontSize: 15, fontWeight: '600' },
  fotoPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 10 },
  guardarBtn: {
    backgroundColor: '#e94560', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  guardarBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cerrarBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cerrarBtnText: { color: '#94a3b8', fontSize: 15 },
});
