import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  Modal,
  Vibration,
  Linking,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { sendPushNotification } from '../../lib/notifications';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getSpaceLabels } from '../../utils/spaceLabels';

type TipoEmergencia = 'emergencia' | 'incendio' | 'robo' | 'medica' | 'otro';

type BarrioInfo = {
  nombre: string;
  direccion: string | null;
};

export function PerfilScreen({ navigation }: any) {
  const { profile, space, signOut, switchSpace: storeSwitchSpace, fetchProfile } = useAuthStore();
  const labels = getSpaceLabels(space?.space_type);
  const [showEmergencia, setShowEmergencia] = useState(false);
  const [compartirUbicacion, setCompartirUbicacion] = useState(false);
  const [showBarrio, setShowBarrio] = useState(false);
  const [showAyuda, setShowAyuda] = useState(false);
  const [showNotificaciones, setShowNotificaciones] = useState(false);
  const [enviandoAlerta, setEnviandoAlerta] = useState(false);
  const [barrioInfo, setBarrioInfo] = useState<BarrioInfo | null>(null);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [misEspacios, setMisEspacios] = useState<{ space_id: string; space_nombre: string; space_type: string; codigo: string }[]>([]);
  const [showEspacios, setShowEspacios] = useState(false);
  const [showNuevoEspacio, setShowNuevoEspacio] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState('residential');
  const [creandoEspacio, setCreandoEspacio] = useState(false);
  const [switchingSpace, setSwitchingSpace] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.barrio_id) {
      fetchBarrioInfo();
    }
    if (profile?.id && profile?.rol === 'admin') {
      cargarMisEspacios();
    }
  }, [profile?.barrio_id, profile?.rol]);

  useEffect(() => {
    AsyncStorage.getItem('compartirUbicacionEmergencia').then(val => {
      if (val === 'true') setCompartirUbicacion(true);
    });
  }, []);

  const cargarMisEspacios = async () => {
    if (!profile?.id) return;
    const { data } = await supabase.rpc('get_mis_espacios', { p_user_id: profile.id });
    if (data) setMisEspacios(data);
  };

  const switchSpace = async (spaceId: string) => {
    if (!profile?.id || switchingSpace) return;
    setSwitchingSpace(true);
    setSwitchError(null);
    try {
      await storeSwitchSpace(spaceId);
      setShowEspacios(false);
    } catch (err: any) {
      setSwitchError(err.message || 'No se pudo cambiar el espacio');
    } finally {
      setSwitchingSpace(false);
    }
  };

  const crearEspacio = async () => {
    if (!profile?.id || !nuevoNombre.trim()) return;
    setCreandoEspacio(true);
    try {
      const { data, error } = await supabase.rpc('crear_espacio_para_usuario', {
        p_user_id:      profile.id,
        p_space_nombre: nuevoNombre.trim(),
        p_space_type:   nuevoTipo,
        p_space_dir:    null,
        p_precio:       0,
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      await storeSwitchSpace(data.space_id);
      await cargarMisEspacios();
      setShowNuevoEspacio(false);
      setNuevoNombre('');
      setNuevoTipo('residential');
      Alert.alert('¡Espacio creado!', `"${nuevoNombre.trim()}" fue creado.\nCódigo de acceso: ${data.codigo}\n\nYa estás administrando el nuevo espacio.`, [{ text: 'OK' }]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear el espacio');
    } finally {
      setCreandoEspacio(false);
    }
  };

  const fetchBarrioInfo = async () => {
    if (!profile?.barrio_id) return;
    const { data } = await supabase
      .from('barrios')
      .select('nombre, direccion')
      .eq('id', profile.barrio_id)
      .maybeSingle();
    if (data) setBarrioInfo(data);
  };

  const fetchNotificaciones = async () => {
    if (!profile?.id) return;
    setLoadingNotif(true);
    const { data } = await supabase
      .from('ingresos')
      .select('id, nombre_visitante, casa_destino, estado, created_at')
      .eq('casa_destino', profile.numero_casa)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotificaciones(data || []);
    setLoadingNotif(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que querés dar de baja tu cuenta? Esta acción no se puede deshacer. Se eliminará toda tu información personal y ya no podrás acceder a la app.')) {
        await deleteAccount();
      }
    } else {
      Alert.alert(
        'Dar de baja cuenta',
        '¿Estás seguro de que querés dar de baja tu cuenta?\n\nEsta acción no se puede deshacer. Se eliminará toda tu información personal y ya no podrás acceder a la app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Dar de baja', style: 'destructive', onPress: deleteAccount },
        ]
      );
    }
  };

  const deleteAccount = async () => {
    if (!profile?.id) return;

    try {
      // Marcar el perfil como inactivo en lugar de eliminarlo completamente
      const { error } = await supabase
        .from('profiles')
        .update({ 
          activo: false,
          email: `deleted_${Date.now()}@deleted.com`,
          nombre: 'Usuario Eliminado',
          numero_casa: null,
          telefono: null
        })
        .eq('id', profile.id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Tu cuenta ha sido dada de baja correctamente. Serás desconectado automáticamente.');
      } else {
        Alert.alert(
          'Cuenta dada de baja',
          'Tu cuenta ha sido dada de baja correctamente. Serás desconectado automáticamente.',
          [{ text: 'OK', onPress: () => signOut() }]
        );
      }

      // Cerrar sesión
      setTimeout(() => signOut(), 1000);
    } catch (error) {
      console.error('Error al dar de baja la cuenta:', error);
      if (Platform.OS === 'web') {
        window.alert('Ocurrió un error al dar de baja tu cuenta. Intentá nuevamente.');
      } else {
        Alert.alert('Error', 'Ocurrió un error al dar de baja tu cuenta. Intentá nuevamente.');
      }
    }
  };

  const checkForUpdates = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Actualizaciones no disponibles', 'Las actualizaciones automáticas no están disponibles en esta versión.');
      return;
    }

    setCheckingUpdates(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        Alert.alert(
          'Actualización disponible',
          '¡Hay una nueva versión disponible! ¿Querés descargarla e instalarla ahora?',
          [
            { text: 'Después', style: 'cancel' },
            { 
              text: 'Actualizar', 
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  Alert.alert(
                    'Actualización lista',
                    'La actualización se descargó correctamente. La app se reiniciará ahora.',
                    [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
                  );
                } catch (error) {
                  Alert.alert('Error', 'No se pudo descargar la actualización. Intentá más tarde.');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('App actualizada', 'Ya tenés la última versión de la app instalada.');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      Alert.alert('Error', 'No se pudo verificar actualizaciones. Revisá tu conexión a internet.');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleToggleUbicacion = async (value: boolean) => {
    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Para enviar tu ubicación en emergencias, habilitá el permiso de ubicación en Configuración del sistema.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setCompartirUbicacion(value);
    AsyncStorage.setItem('compartirUbicacionEmergencia', value ? 'true' : 'false');
  };

  const enviarAlertaEmergencia = async (tipo: TipoEmergencia) => {
    if (!profile?.barrio_id || !profile?.id) return;
    setEnviandoAlerta(true);

    let latitud: number | undefined;
    let longitud: number | undefined;

    if (compartirUbicacion) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitud = loc.coords.latitude;
        longitud = loc.coords.longitude;
      } catch {
        // GPS no disponible, continuar sin ubicación
      }
    }

    const mapsUrl = latitud != null && longitud != null
      ? `\n📍 https://maps.google.com/?q=${latitud},${longitud}`
      : '';

    try {
      const tipoLabels: Record<TipoEmergencia, string> = {
        emergencia: '🚨 Emergencia General',
        incendio: '🔥 Incendio',
        robo: '🚔 Robo/Intrusión',
        medica: '🏥 Emergencia Médica',
        otro: '⚠️ Otro',
      };

      const { error } = await supabase.from('alertas_emergencia').insert({
        barrio_id: profile.barrio_id,
        vecino_id: profile.id,
        tipo,
        numero_casa: profile.numero_casa,
        mensaje: `${tipoLabels[tipo]} - ${labels.unit} ${profile.numero_casa || 'S/N'} (${profile.nombre})`,
        latitud: latitud ?? null,
        longitud: longitud ?? null,
      });

      if (error) throw error;

      const { data: guardias } = await supabase
        .from('profiles')
        .select('expo_push_token, nombre')
        .eq('barrio_id', profile.barrio_id)
        .eq('rol', 'guardia')
        .eq('activo', true);

      if (guardias && guardias.length > 0) {
        const promesas = guardias
          .filter((g) => g.expo_push_token)
          .map((g) =>
            sendPushNotification(
              g.expo_push_token!,
              `${tipoLabels[tipo]}`,
              `${labels.unit} ${profile.numero_casa || 'S/N'} - ${profile.nombre} solicita ayuda urgente${mapsUrl}`,
              { tipo: 'emergencia', numero_casa: profile.numero_casa, latitud, longitud }
            )
          );
        await Promise.all(promesas);
      }

      Vibration.vibrate([0, 200, 100, 200]);
      setShowEmergencia(false);

      const staffLabel = labels.staff.toLowerCase();
      if (Platform.OS === 'web') {
        window.alert(`Alerta enviada al ${staffLabel}`);
      } else {
        Alert.alert('Alerta enviada', `El ${staffLabel} fue notificado.`);
      }
    } catch (error) {
      console.error('Error enviando alerta:', error);
      if (Platform.OS === 'web') {
        window.alert('Error al enviar la alerta. Intentá de nuevo.');
      } else {
        Alert.alert('Error', 'No se pudo enviar la alerta. Intentá de nuevo.');
      }
    } finally {
      setEnviandoAlerta(false);
    }
  };

  const confirmarEmergencia = (tipo: TipoEmergencia) => {
    const tipoLabels: Record<TipoEmergencia, string> = {
      emergencia: 'Emergencia General',
      incendio: 'Incendio',
      robo: 'Robo/Intrusión',
      medica: 'Emergencia Médica',
      otro: 'Otra Emergencia',
    };
    const staffLabel = labels.staff.toLowerCase();

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Confirmar alerta de ${tipoLabels[tipo]}? Se notificará al ${staffLabel}.`)) {
        enviarAlertaEmergencia(tipo);
      }
    } else {
      Alert.alert(
        'Confirmar Alerta',
        `¿Confirmar alerta de ${tipoLabels[tipo]}?\nSe notificará al ${staffLabel}.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'ENVIAR ALERTA', style: 'destructive', onPress: () => enviarAlertaEmergencia(tipo) },
        ]
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.nombre?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.nombre}>{profile?.nombre}</Text>
        <Text style={styles.rol}>{profile?.rol?.toUpperCase()}</Text>
      </View>

      <View style={styles.infoCard}>
        {profile?.numero_casa && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Casa</Text>
            <Text style={styles.infoValue}>{profile.numero_casa}</Text>
          </View>
        )}
        {profile?.telefono && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Teléfono</Text>
            <Text style={styles.infoValue}>{profile.telefono}</Text>
          </View>
        )}
        {barrioInfo?.nombre && (
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Barrio</Text>
            <Text style={styles.infoValue}>{barrioInfo.nombre}</Text>
          </View>
        )}
      </View>

      {/* Switch ubicación en emergencia */}
      <View style={styles.locationSwitchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationSwitchLabel}>Enviar ubicación en emergencias</Text>
          <Text style={styles.locationSwitchSub}>
            {compartirUbicacion
              ? `El ${labels.staff.toLowerCase()} recibirá tu posición GPS 📍`
              : 'Activá para incluir tu ubicación GPS'}
          </Text>
        </View>
        <Switch
          value={compartirUbicacion}
          onValueChange={handleToggleUbicacion}
          trackColor={{ false: '#334155', true: '#22c55e' }}
          thumbColor="#fff"
        />
      </View>

      {/* Botón de Emergencia */}
      <TouchableOpacity
        style={styles.emergencyButton}
        onPress={() => setShowEmergencia(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="warning" size={32} color="#fff" />
        <View>
          <Text style={styles.emergencyText}>Botón de Emergencia</Text>
          <Text style={styles.emergencySubtext}>Alertar al {labels.staff.toLowerCase()}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            fetchNotificaciones();
            setShowNotificaciones(true);
          }}
        >
          <Ionicons name="notifications-outline" size={22} color="#3b82f6" style={{ marginRight: 14 }} />
          <Text style={styles.menuText}>Notificaciones</Text>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowBarrio(true)}
        >
          <Ionicons name="home-outline" size={22} color="#3b82f6" style={{ marginRight: 14 }} />
          <Text style={styles.menuText}>Mi Barrio</Text>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('FaceRegistration')}
        >
          <Ionicons name="scan-outline" size={22} color="#3b82f6" style={{ marginRight: 14 }} />
          <Text style={styles.menuText}>Registro Facial</Text>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowAyuda(true)}
        >
          <Ionicons name="help-circle-outline" size={22} color="#3b82f6" style={{ marginRight: 14 }} />
          <Text style={styles.menuText}>Ayuda</Text>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, checkingUpdates && styles.menuItemDisabled]}
          onPress={checkForUpdates}
          disabled={checkingUpdates}
        >
          <Ionicons name="refresh-outline" size={22} color={checkingUpdates ? "#64748b" : "#3b82f6"} style={{ marginRight: 14 }} />
          <Text style={[styles.menuText, checkingUpdates && styles.menuTextDisabled]}>
            {checkingUpdates ? 'Verificando...' : 'Buscar actualizaciones'}
          </Text>
          {checkingUpdates ? (
            <ActivityIndicator size="small" color="#64748b" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#475569" />
          )}
        </TouchableOpacity>
      </View>

      {profile?.rol === 'admin' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administración</Text>

          {misEspacios.length > 1 && (
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowEspacios(true)}>
              <Ionicons name="swap-horizontal-outline" size={22} color="#06b6d4" style={{ marginRight: 14 }} />
              <Text style={styles.menuText}>Cambiar espacio activo</Text>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuItem} onPress={() => setShowNuevoEspacio(true)}>
            <Ionicons name="add-circle-outline" size={22} color="#06b6d4" style={{ marginRight: 14 }} />
            <Text style={styles.menuText}>Crear nuevo espacio</Text>
            <Ionicons name="chevron-forward" size={18} color="#475569" />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={20} color="#dc2626" />
        <Text style={styles.deleteAccountText}>Dar de baja mi cuenta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Versión 1.0.0</Text>

      {/* Modal: Cambiar espacio activo */}
      <Modal visible={showEspacios} animationType="slide" transparent onRequestClose={() => setShowEspacios(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mis espacios</Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 16 }]}>Seleccioná el espacio que querés administrar</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {misEspacios.map(sp => (
              <TouchableOpacity
                key={sp.space_id}
                style={[styles.menuItem, sp.space_id === profile?.barrio_id && { backgroundColor: '#1e3a5f', borderRadius: 10 }]}
                onPress={() => switchSpace(sp.space_id)}
                disabled={switchingSpace || sp.space_id === profile?.barrio_id}
              >
                <Ionicons name="business-outline" size={20} color="#3b82f6" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuText}>{sp.space_nombre}</Text>
                  <Text style={{ color: '#64748b', fontSize: 12 }}>{sp.space_type}</Text>
                </View>
                {sp.space_id === profile?.barrio_id && (
                  <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                )}
              </TouchableOpacity>
            ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEspacios(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Crear nuevo espacio */}
      <Modal visible={showNuevoEspacio} animationType="slide" transparent onRequestClose={() => setShowNuevoEspacio(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Nuevo espacio</Text>
            <Text style={[styles.modalSubtitle, { marginBottom: 16 }]}>Se creará dentro de tu organización</Text>
            <TextInput
              style={styles.modalInput}
              placeholder='Nombre del espacio (ej: "Gimnasio") '
              placeholderTextColor="#475569"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              autoFocus
            />
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>Tipo de espacio</Text>
            {[
              { value: 'residential', label: '🏘️  Barrio Cerrado' },
              { value: 'gym',         label: '🏋️  Gimnasio' },
              { value: 'club',        label: '🏊  Club' },
              { value: 'event',       label: '🎪  Evento' },
              { value: 'coworking',   label: '💼  Coworking' },
              { value: 'other',       label: '🏢  Otro' },
            ].map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.menuItem, nuevoTipo === t.value && { backgroundColor: '#1e3a5f', borderRadius: 10 }]}
                onPress={() => setNuevoTipo(t.value)}
              >
                <Text style={styles.menuText}>{t.label}</Text>
                {nuevoTipo === t.value && <Ionicons name="checkmark" size={18} color="#3b82f6" />}
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalCloseButton, { flex: 1 }]}
                onPress={() => setShowNuevoEspacio(false)}
              >
                <Text style={styles.modalCloseText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emergencyOption, { flex: 1, backgroundColor: '#3b82f6', justifyContent: 'center', borderRadius: 12, marginBottom: 0 }]}
                onPress={crearEspacio}
                disabled={creandoEspacio || !nuevoNombre.trim()}
              >
                {creandoEspacio
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[styles.emergencyOptionText, { textAlign: 'center' }]}>Crear</Text>
                }
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Emergencia */}
      <Modal visible={showEmergencia} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Tipo de Emergencia</Text>
            <Text style={styles.modalSubtitle}>Seleccioná el tipo de alerta</Text>

            {enviandoAlerta ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e94560" />
                <Text style={styles.loadingText}>Enviando alerta...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={[styles.emergencyOption, { backgroundColor: '#dc2626' }]} onPress={() => confirmarEmergencia('emergencia')}>
                  <Ionicons name="alert-circle" size={24} color="#fff" style={{ marginRight: 14 }} />
                  <Text style={styles.emergencyOptionText}>Emergencia General</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.emergencyOption, { backgroundColor: '#ea580c' }]} onPress={() => confirmarEmergencia('incendio')}>
                  <Ionicons name="flame" size={24} color="#fff" style={{ marginRight: 14 }} />
                  <Text style={styles.emergencyOptionText}>Incendio</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.emergencyOption, { backgroundColor: '#2563eb' }]} onPress={() => confirmarEmergencia('robo')}>
                  <Ionicons name="shield" size={24} color="#fff" style={{ marginRight: 14 }} />
                  <Text style={styles.emergencyOptionText}>Robo / Intrusión</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.emergencyOption, { backgroundColor: '#16a34a' }]} onPress={() => confirmarEmergencia('medica')}>
                  <Ionicons name="medkit" size={24} color="#fff" style={{ marginRight: 14 }} />
                  <Text style={styles.emergencyOptionText}>Emergencia Médica</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.emergencyOption, { backgroundColor: '#9333ea' }]} onPress={() => confirmarEmergencia('otro')}>
                  <Ionicons name="warning" size={24} color="#fff" style={{ marginRight: 14 }} />
                  <Text style={styles.emergencyOptionText}>Otro</Text>
                </TouchableOpacity>
              </>
            )}

            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowEmergencia(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Notificaciones */}
      <Modal visible={showNotificaciones} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notificaciones</Text>
            {loadingNotif ? (
              <ActivityIndicator size="large" color="#e94560" style={{ marginVertical: 32 }} />
            ) : notificaciones.length === 0 ? (
              <Text style={styles.emptyText}>No hay notificaciones recientes</Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {notificaciones.map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <Ionicons
                      name={n.estado === 'autorizado' ? 'checkmark-circle' : n.estado === 'rechazado' ? 'close-circle' : 'time'}
                      size={22}
                      color={n.estado === 'autorizado' ? '#22c55e' : n.estado === 'rechazado' ? '#ef4444' : '#eab308'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifText}>{n.nombre_visitante}</Text>
                      <Text style={styles.notifDate}>{formatDate(n.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowNotificaciones(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Mi Barrio */}
      <Modal visible={showBarrio} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mi Barrio</Text>
            <View style={styles.barrioInfoCard}>
              <View style={styles.barrioInfoRow}>
                <Text style={styles.barrioInfoLabel}>Nombre</Text>
                <Text style={styles.barrioInfoValue}>{barrioInfo?.nombre || '---'}</Text>
              </View>
              <View style={styles.barrioInfoRow}>
                <Text style={styles.barrioInfoLabel}>Dirección</Text>
                <Text style={styles.barrioInfoValue}>{barrioInfo?.direccion || '---'}</Text>
              </View>
              <View style={styles.barrioInfoRow}>
                <Text style={styles.barrioInfoLabel}>Mi Casa</Text>
                <Text style={styles.barrioInfoValue}>{profile?.numero_casa || '---'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBarrio(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Ayuda */}
      <Modal visible={showAyuda} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Ayuda</Text>

            <View style={styles.ayudaItem}>
              <Text style={styles.ayudaTitle}>¿Cómo creo una invitación?</Text>
              <Text style={styles.ayudaDesc}>
                Desde la pantalla de Inicio, tocá "Nueva Invitación", completá los datos del invitado y compartí el QR.
              </Text>
            </View>

            <View style={styles.ayudaItem}>
              <Text style={styles.ayudaTitle}>¿Cómo funciona el botón de emergencia?</Text>
              <Text style={styles.ayudaDesc}>
                Al presionar el botón rojo de emergencia, seleccioná el tipo de alerta. Todos los guardias del barrio recibirán una notificación inmediata.
              </Text>
            </View>

            <View style={styles.ayudaItem}>
              <Text style={styles.ayudaTitle}>¿Cómo agrego contactos frecuentes?</Text>
              <Text style={styles.ayudaDesc}>
                En la pestaña Contactos, tocá "+" para agregar personas que visitarán frecuentemente. Así podés crear invitaciones más rápido.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.ayudaContactButton}
              onPress={() => Linking.openURL('mailto:soporte@barriosapp.com')}
            >
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={styles.ayudaContactText}>Contactar Soporte</Text>
            </TouchableOpacity>

            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAyuda(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
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
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  nombre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 14,
  },
  rol: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    letterSpacing: 1.5,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
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
  locationSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationSwitchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  locationSwitchSub: {
    fontSize: 12,
    color: '#64748b',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  emergencySubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 15,
    padding: 12,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuText: {
    color: '#f1f5f9',
    fontSize: 15,
    flex: 1,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuTextDisabled: {
    color: '#64748b',
  },
  signOutButton: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  deleteAccountText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#475569',
    marginTop: 20,
    fontSize: 12,
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#64748b',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
  },
  emergencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  emergencyOptionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 32,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notifText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '500',
  },
  notifDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  barrioInfoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  barrioInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  barrioInfoLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  barrioInfoValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '500',
  },
  ayudaItem: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ayudaTitle: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  ayudaDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  ayudaContactButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  ayudaContactText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
