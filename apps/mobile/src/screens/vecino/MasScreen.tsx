import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

type MenuItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  screen: string;
  soloTitular?: boolean;
  espacios?: string[];
};

const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Eventos',
    subtitle: 'Invitaciones grupales con QR',
    icon: 'calendar',
    color: '#e94560',
    screen: 'Eventos',
    espacios: ['residential', 'club', 'event', 'coworking'],
  },
  {
    title: 'Amenities',
    subtitle: 'Reservá espacios y canchas',
    icon: 'tennisball',
    color: '#3b82f6',
    screen: 'Amenities',
    espacios: ['residential', 'club', 'gym', 'coworking'],
  },
  {
    title: 'Encuestas',
    subtitle: 'Votaciones de la comunidad',
    icon: 'bar-chart',
    color: '#8b5cf6',
    screen: 'Encuestas',
    soloTitular: true,
    espacios: ['residential', 'club', 'coworking'],
  },
  {
    title: 'Reclamos',
    subtitle: 'Reportá problemas e incidencias',
    icon: 'warning',
    color: '#f59e0b',
    screen: 'Reclamos',
    soloTitular: true,
    espacios: ['residential', 'club', 'coworking'],
  },
  {
    title: 'Personal',
    subtitle: 'Personal autorizado con horarios',
    icon: 'people',
    color: '#10b981',
    screen: 'PersonalTab',
    espacios: ['residential'],
  },
  {
    title: 'Contactos',
    subtitle: 'Personas de confianza',
    icon: 'book',
    color: '#06b6d4',
    screen: 'Contactos',
  },
  {
    title: 'Delivery',
    subtitle: 'QR temporal para delivery',
    icon: 'bicycle',
    color: '#ef4444',
    screen: 'Delivery',
    espacios: ['residential', 'coworking'],
  },
  {
    title: 'Mi Casa',
    subtitle: 'Gestioná tu unidad y autorizados',
    icon: 'home',
    color: '#22c55e',
    screen: 'MiCasa',
    soloTitular: true,
    espacios: ['residential'],
  },
];

const SPACE_TYPE_ICONS: Record<string, string> = {
  residential: '🏘️', gym: '🏋️', club: '🏆', event: '🎪', coworking: '💼', other: '🏢',
};

export function MasScreen() {
  const navigation = useNavigation<any>();
  const { profile, space, memberships, switchSpace } = useAuthStore();
  const esTitular = profile?.es_titular ?? true;
  const spaceType = space?.space_type ?? 'residential';
  const items = MENU_ITEMS.filter(item =>
    (!item.soloTitular || esTitular) &&
    (!item.espacios || item.espacios.includes(spaceType))
  );

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);

  const { fetchProfile } = useAuthStore();

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  const activeMemberships = memberships.filter(m => m.activo && m.estado_aprobacion === 'aprobado');
  const pendingMemberships = memberships.filter(m => m.estado_aprobacion === 'pendiente');

  // Include current space even if it has no membership row (onboarding users)
  const currentSpaceInMemberships = space ? activeMemberships.some(m => m.space_id === space.id) : false;
  const allSwitchableSpaces = [
    ...(space && !currentSpaceInMemberships ? [{
      space_id: space.id,
      space_name: space.nombre,
      space_type: space.space_type,
      rol: profile?.rol ?? 'vecino',
      activo: true,
      estado_aprobacion: 'aprobado',
    }] : []),
    ...activeMemberships,
  ];
  const showSpaceSwitcher = allSwitchableSpaces.length > 1;

  const handleSwitch = async (spaceId: string) => {
    setSwitching(true);
    await switchSpace(spaceId);
    setSwitching(false);
    setShowSwitcher(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Más</Text>

      {/* Space switcher card */}
      {showSpaceSwitcher && (
        <TouchableOpacity style={styles.spaceSwitcherCard} onPress={() => setShowSwitcher(true)}>
          <View style={styles.spaceSwitcherLeft}>
            <Text style={styles.spaceSwitcherIcon}>{SPACE_TYPE_ICONS[space?.space_type ?? ''] ?? '🏢'}</Text>
            <View>
              <Text style={styles.spaceSwitcherLabel}>Espacio activo</Text>
              <Text style={styles.spaceSwitcherName}>{space?.nombre ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.switchBadge}>
            <Text style={styles.switchBadgeText}>{allSwitchableSpaces.length} espacios</Text>
            <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
          </View>
        </TouchableOpacity>
      )}

      {/* Pending memberships notice */}
      {pendingMemberships.length > 0 && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={16} color="#f59e0b" />
          <Text style={styles.pendingText}>
            {pendingMemberships.length === 1
              ? `Solicitud pendiente en "${pendingMemberships[0].space_name}"`
              : `${pendingMemberships.length} solicitudes pendientes de aprobación`}
          </Text>
        </View>
      )}

      {!esTitular && (
        <View style={styles.subUserBanner}>
          <Ionicons name="information-circle" size={16} color="#94a3b8" />
          <Text style={styles.subUserText}>Acceso autorizado por el titular de tu unidad</Text>
        </View>
      )}

      <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('JoinSpace')}>
        <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
        <Text style={styles.joinButtonText}>Unirse a otro espacio</Text>
        <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
      </TouchableOpacity>

      {/* Space switcher modal */}
      <Modal visible={showSwitcher} transparent animationType="slide" onRequestClose={() => setShowSwitcher(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar espacio</Text>
            {switching && <ActivityIndicator color="#3b82f6" style={{ marginBottom: 12 }} />}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {allSwitchableSpaces.map(m => (
              <TouchableOpacity
                key={m.space_id}
                style={[styles.membershipRow, m.space_id === space?.id && styles.membershipRowActive]}
                onPress={() => handleSwitch(m.space_id)}
                disabled={switching || m.space_id === space?.id}
              >
                <Text style={styles.membershipIcon}>{SPACE_TYPE_ICONS[m.space_type] ?? '🏢'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.membershipName}>{m.space_name}</Text>
                  <Text style={styles.membershipMeta}>{m.rol.toUpperCase()}</Text>
                </View>
                {m.space_id === space?.id && <Ionicons name="checkmark-circle" size={20} color="#22c55e" />}
              </TouchableOpacity>
            ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowSwitcher(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.grid}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.card}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  subUserBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 16 },
  subUserText: { fontSize: 13, color: '#94a3b8', flex: 1 },
  spaceSwitcherCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  spaceSwitcherLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spaceSwitcherIcon: { fontSize: 28 },
  spaceSwitcherLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  spaceSwitcherName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  switchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#172554', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  switchBadgeText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1c1400', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#78350f' },
  pendingText: { fontSize: 13, color: '#fbbf24', flex: 1 },
  joinButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#172554', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1d4ed8' },
  joinButtonText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 20, textAlign: 'center' },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  membershipRowActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  membershipIcon: { fontSize: 24 },
  membershipName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  membershipMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalClose: { marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: '#334155', alignItems: 'center' },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
