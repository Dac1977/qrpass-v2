import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { spacesApi } from '../../lib/api';

export function RegisterScreen({ navigation, route }: any) {
  const initialCodigo: string = route?.params?.codigo ?? '';
  const [step, setStep] = useState<'codigo' | 'registro'>(initialCodigo ? 'codigo' : 'codigo');
  const [codigoBarrio, setCodigoBarrio] = useState(initialCodigo.toUpperCase());
  const [barrioInfo, setBarrioInfo] = useState<{ id: string; nombre: string } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [autoValidated, setAutoValidated] = useState(false);
  
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [numeroCasa, setNumeroCasa] = useState('');
  const [telefono, setTelefono] = useState('');
  const { signUp, loading } = useAuthStore();

  useEffect(() => {
    if (initialCodigo && !autoValidated) {
      setAutoValidated(true);
      validarCodigo();
    }
  }, []);

  const validarCodigo = async () => {
    if (!codigoBarrio.trim()) {
      Alert.alert('Error', 'Ingresá el código de barrio');
      return;
    }

    setValidatingCode(true);
    try {
      const { space } = await spacesApi.byCode(codigoBarrio);
      setBarrioInfo({ id: space.id, nombre: space.nombre });
      setStep('registro');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Código de invitación inválido o inactivo');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleRegister = async () => {
    if (!nombre || !email || !password) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!barrioInfo) {
      Alert.alert('Error', 'No se ha validado el código de barrio');
      return;
    }

    const { error } = await signUp(email, password, nombre, {
      codigoInvitacion: codigoBarrio,
      numeroUnidad: numeroCasa || undefined,
      telefono: telefono || undefined,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Registro exitoso',
        `Tu solicitud fue enviada al administrador del barrio "${barrioInfo.nombre}". Te notificaremos cuando sea aprobada.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {step === 'codigo' ? (
            <>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../../assets/qrpasssintextotransparente.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>🏘️ Registro de Vecino</Text>
              <Text style={styles.subtitle}>Ingresá el código de invitación de tu barrio</Text>

              <TextInput
                style={styles.input}
                placeholder="Código de invitación (ej: ABC12345)"
                placeholderTextColor="#999"
                value={codigoBarrio}
                onChangeText={(text) => setCodigoBarrio(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />

              <TouchableOpacity
                style={[styles.button, validatingCode && styles.buttonDisabled]}
                onPress={validarCodigo}
                disabled={validatingCode}
              >
                {validatingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Validar Código</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.linkText}>Ya tengo cuenta</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>📝 Completá tus Datos</Text>
              <Text style={styles.subtitle}>Registrándote en: {barrioInfo?.nombre}</Text>

              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor="#999"
                value={nombre}
                onChangeText={setNombre}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Confirmar contraseña"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Número de casa (ej: 12A)"
                placeholderTextColor="#999"
                value={numeroCasa}
                onChangeText={setNumeroCasa}
              />

              <TextInput
                style={styles.input}
                placeholder="Teléfono (opcional)"
                placeholderTextColor="#999"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Registrarme</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setStep('codigo');
                  setCodigoBarrio('');
                  setBarrioInfo(null);
                }}
              >
                <Text style={styles.linkText}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  button: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#e94560',
    fontSize: 14,
  },
});
