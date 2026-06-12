import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';

export function MiCasaScreen() {
  const navigation = useNavigation();
  const { profile } = useAuthStore();
  const [loading] = useState(false);

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
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.infoCard}>
          <Ionicons name="home" size={24} color="#22c55e" />
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>Casa {profile?.numeroCasa}</Text>
            <Text style={s.infoSub}>Gestioná el acceso de tu casa</Text>
          </View>
        </View>

        <View style={s.emptyBox}>
          <Ionicons name="people-outline" size={40} color="#334155" />
          <Text style={s.emptyText}>Gestión de autorizados</Text>
          <Text style={s.emptySub}>Esta funcionalidad estará disponible próximamente</Text>
        </View>

        <View style={s.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color="#64748b" />
          <Text style={s.noteText}>
            Los autorizados podrán ingresar al barrio pero no verán encuestas, reclamos ni expensas.
          </Text>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
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
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  emptySub: { color: '#475569', fontSize: 13, textAlign: 'center' },
  noteCard: { flexDirection: 'row', gap: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },
});
