import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { personalApi, PersonalPermanente, PermisoHorario } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const DIAS_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

const DIAS_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function DetallePersonalScreen({ route, navigation }: any) {
  const { personalId } = route.params;
  const { profile } = useAuthStore();
  const [personal, setPersonal] = useState<PersonalPermanente | null>(null);
  const [horarios, setHorarios] = useState<PermisoHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const viewShotRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, [personalId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, personalId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { personal: todos } = await personalApi.mis();
      const found = todos.find((p) => p.id === personalId) ?? null;
      setPersonal(found);
    } catch {
      setPersonal(null);
    } finally {
      setLoading(false);
    }
  };

  const compartirQR = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await viewShotRef.current.capture();
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.download = `qr-${personal?.nombre || 'personal'}.png`;
        link.href = uri;
        link.click();
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `QR de ${personal?.nombre}`,
        });
      }
    } catch (error) {
      console.error('Error compartiendo QR:', error);
    }
  };

  const desvincular = () => {
    const doDesvincular = async () => {
      try {
        await personalApi.eliminar(personalId);
        navigation.goBack();
      } catch {
        Alert.alert('Error', 'No se pudo desvincular.');
      }
    };

    Alert.alert(
      'Desvincular',
      '¿Querés desvincular a esta persona de tu casa? Ya no podrá ingresar con los horarios configurados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desvincular', style: 'destructive', onPress: doDesvincular },
      ]
    );
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
      {/* Perfil */}
      <View style={styles.profileCard}>
        {personal.foto ? (
          <Image source={{ uri: personal.foto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color="#64748b" />
          </View>
        )}
        <Text style={styles.nombre}>{personal.nombre}</Text>
        <Text style={styles.dni}>DNI: {personal.dni}</Text>
        {personal.telefono && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>{personal.telefono}</Text>
          </View>
        )}
      </View>

      {/* QR */}
      <View style={styles.qrSection}>
        <Text style={styles.sectionTitle}>Código QR</Text>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.qrCard}>
            <QRCode value={personal.qrCode} size={180} backgroundColor="#fff" color="#0f172a" />
            <Text style={styles.qrNombre}>{personal.nombre}</Text>
            <Text style={styles.qrDni}>DNI: {personal.dni}</Text>
            <Text style={styles.qrCode}>{personal.qrCode}</Text>
          </View>
        </ViewShot>
        <TouchableOpacity style={styles.shareBtn} onPress={compartirQR} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Compartir QR</Text>
        </TouchableOpacity>
      </View>

      {/* Editar */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => navigation.navigate('EditarPersonal', { personalId })}
        activeOpacity={0.7}
      >
        <Ionicons name="create-outline" size={20} color="#fff" />
        <Text style={styles.editBtnText}>Editar datos y horarios</Text>
      </TouchableOpacity>

      {/* Horarios */}
      <View style={styles.horariosSection}>
        <Text style={styles.sectionTitle}>Horarios Permitidos</Text>
        {DIAS_ORDER.map((dia) => {
          const horario = personal.permisos.find((h) => h.diaSemana === dia);
          if (!horario) return null;
          return (
            <View key={dia} style={styles.horarioCard}>
              <View style={styles.horarioDia}>
                <Text style={styles.horarioDiaText}>{DIAS_LABELS[dia]}</Text>
              </View>
              <View style={styles.horarioHoras}>
                <Ionicons name="log-in-outline" size={16} color="#22c55e" />
                <Text style={styles.horarioHoraText}>{formatHora(horario.horaEntrada ?? '')}</Text>
                <Ionicons name="arrow-forward" size={14} color="#475569" />
                <Ionicons name="log-out-outline" size={16} color="#f97316" />
                <Text style={styles.horarioHoraText}>{formatHora(horario.horaSalida ?? '')}</Text>
              </View>
            </View>
          );
        })}
        {personal.permisos.length === 0 && (
          <Text style={styles.noHorarios}>Sin horarios configurados para tu casa</Text>
        )}
      </View>

      {/* Desvincular */}
      <TouchableOpacity style={styles.desvincularBtn} onPress={desvincular} activeOpacity={0.7}>
        <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
        <Text style={styles.desvincularText}>Desvincular de mi casa</Text>
      </TouchableOpacity>
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
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#3b82f6',
    marginBottom: 14,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  nombre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  dni: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
  },
  qrSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: 280,
  },
  qrNombre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
  },
  qrDni: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  qrCode: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 14,
    gap: 8,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  horariosSection: {
    marginTop: 24,
  },
  horarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  horarioDia: {
    width: 100,
  },
  horarioDiaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  horarioHoras: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  horarioHoraText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  noHorarios: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    padding: 20,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  desvincularBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  desvincularText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
});
