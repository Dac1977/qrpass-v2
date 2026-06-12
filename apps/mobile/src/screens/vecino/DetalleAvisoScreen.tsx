import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avisosApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSpaceLabels } from '../../utils/spaceLabels';

const categoriaIconos: Record<string, keyof typeof Ionicons.glyphMap> = {
  general: 'megaphone-outline',
  urgente: 'alert-circle-outline',
  evento: 'calendar-outline',
  perdido: 'search-outline',
  venta: 'pricetag-outline',
  servicio: 'construct-outline',
};

const categoriaColores: Record<string, string> = {
  general: '#3b82f6',
  urgente: '#ef4444',
  evento: '#8b5cf6',
  perdido: '#f59e0b',
  venta: '#22c55e',
  servicio: '#06b6d4',
};

export function DetalleAvisoScreen({ route, navigation }: any) {
  const { aviso } = route.params;
  const { profile, space } = useAuthStore();
  const labels = getSpaceLabels(space?.spaceType);
  const isAutor = profile?.id === aviso.autorId;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const eliminarAviso = async () => {
    const confirmar = Platform.OS === 'web'
      ? window.confirm('¿Estás seguro que querés eliminar este aviso?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Eliminar aviso',
            '¿Estás seguro?',
            [
              { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Eliminar', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

    if (!confirmar) return;

    try {
      await avisosApi.eliminar(aviso.id);
      navigation.goBack();
    } catch {}
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.categoriaTag, { backgroundColor: categoriaColores[aviso.categoria] }]}>
        <Ionicons name={categoriaIconos[aviso.categoria] as any} size={14} color="#fff" />
        <Text style={styles.categoriaText}>{aviso.categoria.toUpperCase()}</Text>
      </View>

      <Text style={styles.titulo}>{aviso.titulo}</Text>

      <View style={styles.autorContainer}>
        <View style={styles.autorAvatar}>
          <Text style={styles.autorAvatarText}>
            {aviso.autor?.nombre?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View>
          <Text style={styles.autorNombre}>{aviso.autor?.nombre}</Text>
          <Text style={styles.autorCasa}>
            {aviso.autor?.numeroCasa ? `${labels.unit} ${aviso.autor.numeroCasa}` : labels.member}
          </Text>
        </View>
      </View>

      <Text style={styles.fecha}>{formatDate(aviso.createdAt)}</Text>

      <View style={styles.contenidoContainer}>
        <Text style={styles.contenido}>{aviso.contenido}</Text>
      </View>

      {isAutor && (
        <TouchableOpacity style={styles.deleteButton} onPress={eliminarAviso}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={styles.deleteButtonText}>Eliminar mi aviso</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  categoriaTag: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    gap: 5,
  },
  categoriaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 20,
    lineHeight: 34,
  },
  autorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  autorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  autorAvatarText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  autorNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  autorCasa: {
    fontSize: 13,
    color: '#64748b',
  },
  fecha: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 20,
  },
  contenidoContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  contenido: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 26,
  },
  deleteButton: {
    flexDirection: 'row',
    marginTop: 28,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '500',
  },
});
