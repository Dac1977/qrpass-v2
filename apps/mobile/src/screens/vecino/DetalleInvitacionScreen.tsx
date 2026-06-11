import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase, Invitacion } from '../../lib/supabase';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const copyToClipboard = async (text: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch (e) {
    console.log('Clipboard not available');
  }
};

export function DetalleInvitacionScreen({ route, navigation }: any) {
  const { invitacion } = route.params as { invitacion: Invitacion };
  const qrRef = useRef<ViewShot>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const compartirQR = async () => {
    const mensaje = `🏠 Invitación de acceso al barrio\n\nMostrá este código QR en la guardia o dictá el código:\n\n📝 Código: ${invitacion.qr_code}\n\n👤 Invitado: ${invitacion.nombre_invitado}\n⏰ Válido hasta: ${formatDate(invitacion.valido_hasta)}`;
    
    try {
      if (Platform.OS === 'web') {
        await copyToClipboard(mensaje);
        Alert.alert('Copiado', 'El mensaje se copió al portapapeles');
      } else {
        await Share.share({ message: mensaje });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const copiarCodigo = async () => {
    await copyToClipboard(invitacion.qr_code);
    if (Platform.OS === 'web') {
      window.alert('Código copiado al portapapeles');
    } else {
      Alert.alert('Copiado', 'Código copiado al portapapeles');
    }
  };

  const compartirWhatsApp = async () => {
    if (Platform.OS === 'web') {
      const mensaje = `🏠 *Invitación de acceso al barrio*\n\nMostrá este código en la guardia:\n\n📝 *Código:* ${invitacion.qr_code}\n\n👤 *Invitado:* ${invitacion.nombre_invitado}\n⏰ *Válido hasta:* ${formatDate(invitacion.valido_hasta)}`;
      const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
      Linking.openURL(url);
      return;
    }

    try {
      const uri = await qrRef.current?.capture?.();
      if (uri) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Compartir QR de invitación',
          });
        } else {
          Alert.alert('Error', 'Compartir no disponible en este dispositivo');
        }
      }
    } catch (error) {
      console.error('Error sharing QR:', error);
      Alert.alert('Error', 'No se pudo compartir la imagen');
    }
  };

  const cancelarInvitacion = async () => {
    Alert.alert(
      'Cancelar invitación',
      '¿Estás seguro? El QR dejará de funcionar.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('invitaciones')
              .update({ activo: false })
              .eq('id', invitacion.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const isExpired = new Date(invitacion.valido_hasta) < new Date();
  const isUsed = invitacion.usos_actuales >= invitacion.usos_permitidos;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ViewShot ref={qrRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.qrCard}>
          <View style={styles.qrContainer}>
            <QRCode
              value={invitacion.qr_code}
              size={250}
              backgroundColor="#fff"
              color="#1a1a2e"
            />
          </View>
          <Text style={styles.qrNombre} numberOfLines={1}>{invitacion.nombre_invitado}</Text>
          {invitacion.dni_invitado && (
            <Text style={styles.qrDni}>DNI: {invitacion.dni_invitado}</Text>
          )}
          <Text style={styles.qrCodigo}>{invitacion.qr_code}</Text>
        </View>
      </ViewShot>

      <Text style={styles.nombre} numberOfLines={2}>{invitacion.nombre_invitado}</Text>

      {(isExpired || isUsed) && (
        <View style={styles.expiredBadge}>
          <Text style={styles.expiredText}>
            {isExpired ? 'EXPIRADO' : 'YA UTILIZADO'}
          </Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Válido hasta</Text>
          <Text style={styles.infoValue}>{formatDate(invitacion.valido_hasta)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ingresos</Text>
          <Text style={styles.infoValue}>
            {invitacion.usos_actuales} de {invitacion.usos_permitidos}
          </Text>
        </View>

        {invitacion.dni_invitado && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DNI</Text>
            <Text style={styles.infoValue}>{invitacion.dni_invitado}</Text>
          </View>
        )}

        {invitacion.patente && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patente</Text>
            <Text style={styles.infoValue}>{invitacion.patente}</Text>
          </View>
        )}
      </View>

      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>Código:</Text>
        <TouchableOpacity onPress={copiarCodigo}>
          <Text style={styles.codeText}>{invitacion.qr_code}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.whatsappButton} onPress={compartirWhatsApp} activeOpacity={0.8}>
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.whatsappButtonText}>Enviar por WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={compartirQR} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareButtonText}>Compartir</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.copyButton} onPress={copiarCodigo} activeOpacity={0.8}>
          <Ionicons name="copy-outline" size={20} color="#94a3b8" />
          <Text style={styles.copyButtonText}>Copiar código</Text>
        </TouchableOpacity>

        {!isExpired && !isUsed && (
          <TouchableOpacity style={styles.cancelButton} onPress={cancelarInvitacion}>
            <Text style={styles.cancelButtonText}>Cancelar invitación</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: '#0f172a',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    padding: 20,
  },
  qrCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    marginTop: 16,
    alignItems: 'center',
    width: 300,
  },
  qrContainer: {
    padding: 0,
  },
  qrNombre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
    textAlign: 'center',
  },
  qrDni: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    fontWeight: '500',
  },
  qrCodigo: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  nombre: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 20,
    textAlign: 'center',
  },
  expiredBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  expiredText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  infoContainer: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  infoValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  whatsappButton: {
    flexDirection: 'row',
    backgroundColor: '#25D366',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  copyButton: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  copyButtonText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  bottomSpacer: {
    height: 32,
  },
  codeContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  codeLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  codeText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  cancelButton: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '500',
  },
});
