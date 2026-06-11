import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';

type SubUsuario = {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  estado_aprobacion: string | null;
  created_at: string;
};

export function MiCasaScreen() {
  const navigation = useNavigation();
  const { profile } = useAuthStore();
  const [subUsuarios, setSubUsuarios] = useState<SubUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNombre, setInviteNombre] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre, email, activo, estado_aprobacion, created_at')
        .eq('titular_id', profile.id)
        .order('created_at');

      if (error) throw error;
      setSubUsuarios((data as SubUsuario[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => { cargar(); }, [cargar]);
  const onRefresh = () => { setRefreshing(true); cargar(); };

  const toggleActivo = (sub: SubUsuario) => {
    const accion = sub.activo ? 'desactivar' : 'activar';
    Alert.alert(
      `${sub.activo ? 'Desactivar' : 'Activar'} acceso`,
      `¿Querés ${accion} el acceso de ${sub.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await supabase.from('profiles').update({ activo: !sub.activo }).eq('id', sub.id);
            cargar();
          },
        },
      ],
    );
  };

  const eliminarSubUsuario = (sub: SubUsuario) => {
    Alert.alert(
      'Eliminar autorizado',
      `¿Estás seguro de eliminar a ${sub.nombre} de tu casa? Perderá acceso al barrio.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('profiles')
              .update({ titular_id: null, es_titular: false, barrio_id: null })
              .eq('id', sub.id);
            cargar();
          },
        },
      ],
    );
  };

  const agregarSubUsuario = async () => {
    if (!inviteNombre.trim() || !inviteEmail.trim() || !invitePassword.trim()) {
      setInviteError('Completá todos los campos');
      return;
    }
    if (!profile?.barrio_id || !profile?.numero_casa) {
      setInviteError('Tu perfil no tiene barrio o número de casa asignado');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteEmail.trim(),
        password: invitePassword.trim(),
        options: { data: { nombre: inviteNombre.trim(), rol: 'vecino' } },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user?.id) throw new Error('No se pudo crear el usuario');

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        nombre: inviteNombre.trim(),
        email: inviteEmail.trim(),
        rol: 'vecino',
        barrio_id: profile.barrio_id,
        numero_casa: profile.numero_casa,
        titular_id: profile.id,
        es_titular: false,
        estado_aprobacion: 'aprobado',
        activo: true,
      });

      if (profileError) throw profileError;

      setShowInviteModal(false);
      setInviteNombre('');
      setInviteEmail('');
      setInvitePassword('');
      cargar();
    } catch (err: any) {
      setInviteError(err.message || 'No se pudo agregar el autorizado');
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <AppHeader title="Mi Casa" showBack onBackPress={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <AppHeader title="Mi Casa" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        <View style={s.infoCard}>
          <Ionicons name="home" size={24} color="#22c55e" />
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>Casa {profile?.numero_casa}</Text>
            <Text style={s.infoSub}>Vos sos el titular — gestionás quién tiene acceso</Text>
          </View>
        </View>

        <View style={s.rowBetween}>
          <Text style={s.sectionTitle}>Autorizados ({subUsuarios.length})</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowInviteModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {subUsuarios.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={40} color="#334155" />
            <Text style={s.emptyText}>No tenés autorizados en tu casa</Text>
            <Text style={s.emptySub}>Agregá familiares para que puedan ingresar al barrio</Text>
          </View>
        ) : (
          subUsuarios.map((sub) => (
            <View key={sub.id} style={s.card}>
              <View style={[s.avatar, { backgroundColor: sub.activo ? '#22c55e20' : '#ef444420' }]}>
                <Ionicons name="person" size={22} color={sub.activo ? '#22c55e' : '#ef4444'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{sub.nombre}</Text>
                <Text style={s.cardEmail}>{sub.email}</Text>
                <Text style={[s.cardStatus, { color: sub.activo ? '#22c55e' : '#ef4444' }]}>
                  {sub.activo ? 'Acceso activo' : 'Acceso desactivado'}
                </Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => toggleActivo(sub)}>
                  <Ionicons
                    name={sub.activo ? 'pause-circle' : 'play-circle'}
                    size={24}
                    color={sub.activo ? '#f59e0b' : '#22c55e'}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => eliminarSubUsuario(sub)}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={s.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color="#64748b" />
          <Text style={s.noteText}>
            Los autorizados pueden ingresar al barrio pero no ven encuestas, reclamos ni expensas.
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showInviteModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInviteModal(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Agregar autorizado</Text>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <Text style={s.modalNote}>
              Creá una cuenta para un familiar o conviviente. Podrá ingresar al barrio con QR o reconocimiento facial.
            </Text>
            <Text style={s.label}>Nombre completo</Text>
            <TextInput
              style={s.input}
              value={inviteNombre}
              onChangeText={setInviteNombre}
              placeholder="Ej: María García"
              placeholderTextColor="#475569"
            />
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="email@ejemplo.com"
              placeholderTextColor="#475569"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={s.label}>Contraseña temporal</Text>
            <TextInput
              style={s.input}
              value={invitePassword}
              onChangeText={setInvitePassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#475569"
              secureTextEntry
            />
            {inviteError && (
              <Text style={s.errorText}>{inviteError}</Text>
            )}
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowInviteModal(false)}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={agregarSubUsuario} disabled={inviteLoading}>
              <Text style={s.saveBtnText}>{inviteLoading ? 'Creando...' : 'Agregar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#14532d20', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#22c55e30' },
  infoTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  infoSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  emptySub: { color: '#475569', fontSize: 13, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardStatus: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  noteCard: { flexDirection: 'row', gap: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },
  modalContainer: { flex: 1, backgroundColor: '#0f172a' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  modalScroll: { padding: 20 },
  modalNote: { fontSize: 13, color: '#94a3b8', lineHeight: 20, marginBottom: 20, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 12 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#1e293b' },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center', padding: 14 },
  cancelBtnText: { color: '#94a3b8', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#3b82f6', borderRadius: 14, alignItems: 'center', padding: 14 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
