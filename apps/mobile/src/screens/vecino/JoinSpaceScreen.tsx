import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

const SPACE_TYPE_ICONS: Record<string, string> = {
  residential: '🏘️', gym: '🏋️', club: '🏆', event: '🎪', coworking: '💼', other: '🏢',
};

export function JoinSpaceScreen({ route, navigation }: any) {
  const codigoParam: string = (route?.params?.codigo ?? '').toUpperCase();
  const { profile, fetchProfile } = useAuthStore();

  const [inputCodigo, setInputCodigo] = useState(codigoParam);
  const [spaceInfo, setSpaceInfo] = useState<{ id: string; nombre: string; space_type: string } | null>(null);
  const [loading, setLoading]     = useState(!!codigoParam);
  const [searching, setSearching] = useState(false);
  const [invalid, setInvalid]     = useState(false);
  const [numeroUnidad, setNumeroUnidad] = useState('');
  const [joining, setJoining]     = useState(false);
  const [done, setDone]           = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  const buscarEspacio = async (cod: string) => {
    if (!cod.trim()) return;
    setSearching(true);
    setInvalid(false);
    setSpaceInfo(null);
    const { data, error } = await supabase.rpc('validar_codigo_invitacion', { p_codigo: cod.toUpperCase() });
    const result = (data as any[])?.[0];
    if (!error && result?.valido) {
      setSpaceInfo({ id: result.barrio_id, nombre: result.barrio_nombre, space_type: result.space_type ?? 'residential' });
    } else {
      setInvalid(true);
    }
    setSearching(false);
    setLoading(false);
  };

  useEffect(() => {
    if (codigoParam) buscarEspacio(codigoParam);
    else setLoading(false);
  }, [codigoParam]);

  const handleJoin = async () => {
    if (!profile?.id || !spaceInfo) return;
    setJoining(true);
    const { data } = await supabase.rpc('unirse_a_espacio', {
      p_user_id:       profile.id,
      p_codigo:        inputCodigo,
      p_numero_unidad: numeroUnidad.trim() || null,
    });
    const res = data as any;
    if (res?.success) {
      setDone(true);
      await fetchProfile();
      Alert.alert(
        '✅ Solicitud enviada',
        `Tu solicitud para "${spaceInfo.nombre}" fue enviada. El administrador debe aprobarte.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else if (res?.error?.includes('ya')) {
      setAlreadyMember(true);
    } else {
      Alert.alert('Error', res?.error ?? 'Error al enviar solicitud');
    }
    setJoining(false);
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );

  if (!spaceInfo) return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.iconBig}>🏢</Text>
      <Text style={styles.title}>Unirse a un espacio</Text>
      <Text style={styles.subtitle}>Ingresá el código de invitación que te compartió el administrador</Text>
      {invalid && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ Código inválido o expirado. Verificá con el administrador.</Text>
        </View>
      )}
      <TextInput
        style={styles.input}
        placeholder="Código de invitación (ej: ABCD1234)"
        placeholderTextColor="#475569"
        value={inputCodigo}
        onChangeText={v => { setInputCodigo(v.toUpperCase()); setInvalid(false); }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
      />
      <TouchableOpacity
        style={[styles.btn, (searching || !inputCodigo.trim()) && styles.btnDisabled]}
        onPress={() => buscarEspacio(inputCodigo)}
        disabled={searching || !inputCodigo.trim()}
      >
        {searching
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Buscar espacio</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (alreadyMember) return (
    <View style={styles.center}>
      <Text style={styles.iconBig}>ℹ️</Text>
      <Text style={styles.title}>Ya sos miembro</Text>
      <Text style={styles.subtitle}>Ya tenés una membresía en "{spaceInfo.nombre}".</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );

  const icon = SPACE_TYPE_ICONS[spaceInfo.space_type] ?? '🏢';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.iconBig}>{icon}</Text>
      <Text style={styles.title}>{spaceInfo.nombre}</Text>
      <View style={styles.codePill}>
        <Text style={styles.codeText}>{inputCodigo}</Text>
      </View>
      <Text style={styles.subtitle}>
        {profile?.nombre ? `Hola ${profile.nombre}, ` : ''}
        ¿Querés unirte a este espacio?
      </Text>

      <TextInput
        style={styles.input}
        placeholder="N° de unidad / casillero (opcional)"
        placeholderTextColor="#64748b"
        value={numeroUnidad}
        onChangeText={setNumeroUnidad}
      />

      <TouchableOpacity
        style={[styles.btn, joining && styles.btnDisabled]}
        onPress={handleJoin}
        disabled={joining}
      >
        {joining
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Unirme a {spaceInfo.nombre}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:      { flexGrow: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  center:      { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconBig:     { fontSize: 64, marginBottom: 16 },
  title:       { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle:    { fontSize: 15, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  codePill:    { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  codeText:    { fontSize: 22, fontWeight: '800', color: '#3b82f6', letterSpacing: 4 },
  input:       { width: '100%', backgroundColor: '#1e293b', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  btn:         { width: '100%', backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:   { padding: 12 },
  cancelText:  { color: '#475569', fontSize: 14 },
  backBtn:     { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1e293b', borderRadius: 12 },
  backBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  errorBox:    { backgroundColor: '#450a0a', borderRadius: 12, padding: 12, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: '#ef4444' },
  errorText:   { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
});
