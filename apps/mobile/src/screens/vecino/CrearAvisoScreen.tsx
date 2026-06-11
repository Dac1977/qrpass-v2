import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { sendPushNotification } from '../../lib/notifications';

const categorias = [
  { id: 'general', label: 'General', icon: 'megaphone-outline' as const },
  { id: 'urgente', label: 'Urgente', icon: 'alert-circle-outline' as const },
  { id: 'evento', label: 'Evento', icon: 'calendar-outline' as const },
  { id: 'perdido', label: 'Perdido/Encontrado', icon: 'search-outline' as const },
  { id: 'venta', label: 'Venta/Trueque', icon: 'pricetag-outline' as const },
  { id: 'servicio', label: 'Servicio', icon: 'construct-outline' as const },
];

export function CrearAvisoScreen({ navigation }: any) {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoria, setCategoria] = useState('general');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuthStore();

  const publicarAviso = async () => {
    if (!titulo.trim()) {
      if (Platform.OS === 'web') {
        window.alert('El título es obligatorio');
      } else {
        Alert.alert('Error', 'El título es obligatorio');
      }
      return;
    }

    if (!contenido.trim()) {
      if (Platform.OS === 'web') {
        window.alert('El contenido es obligatorio');
      } else {
        Alert.alert('Error', 'El contenido es obligatorio');
      }
      return;
    }

    if (!profile?.barrio_id) {
      Alert.alert('Error', 'No estás asignado a un barrio');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('avisos').insert({
      barrio_id: profile.barrio_id,
      autor_id: profile.id,
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      categoria,
    });

    if (error) {
      setLoading(false);
      console.error('Error creando aviso:', error);
      Alert.alert('Error', 'No se pudo publicar el aviso');
      return;
    }

    const { data: miembros } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('barrio_id', profile.barrio_id)
      .eq('activo', true)
      .neq('id', profile.id);

    if (miembros) {
      const iconos: Record<string, string> = {
        urgente: '🚨', evento: '📅', perdido: '🔍', venta: '🏷️', servicio: '🔧', general: '📢',
      };
      const icono = iconos[categoria] ?? '📢';
      await Promise.allSettled(
        miembros
          .filter(m => m.expo_push_token)
          .map(m => sendPushNotification(
            m.expo_push_token!,
            `${icono} ${titulo.trim()}`,
            contenido.trim().slice(0, 120),
            { tipo: 'aviso', categoria },
          ))
      );
    }

    setLoading(false);

    if (Platform.OS === 'web') {
      window.alert('¡Aviso publicado!');
      navigation.goBack();
    } else {
      Alert.alert('¡Publicado!', 'Tu aviso ya está visible para todos', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Se busca jardinero"
        placeholderTextColor="#666"
        value={titulo}
        onChangeText={setTitulo}
        maxLength={100}
      />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categoriasContainer}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoriaButton,
              categoria === cat.id && styles.categoriaSelected,
            ]}
            onPress={() => setCategoria(cat.id)}
          >
            <Ionicons name={cat.icon} size={16} color={categoria === cat.id ? '#fff' : '#64748b'} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.categoriaLabel,
                categoria === cat.id && styles.categoriaLabelSelected,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Contenido</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Escribí los detalles de tu aviso..."
        placeholderTextColor="#666"
        value={contenido}
        onChangeText={setContenido}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        maxLength={1000}
      />

      <TouchableOpacity
        style={[styles.publishButton, loading && styles.publishButtonDisabled]}
        onPress={publicarAviso}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="megaphone" size={20} color="#fff" />
            <Text style={styles.publishButtonText}>Publicar aviso</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Tu aviso será visible para todos los vecinos del barrio
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 16,
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
  textArea: {
    minHeight: 150,
    paddingTop: 14,
  },
  categoriasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoriaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoriaSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoriaLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  categoriaLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  publishButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    gap: 10,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  hint: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 40,
  },
});
