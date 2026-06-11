import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase, Invitacion } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AppHeader } from '../../components/AppHeader';

export function HomeScreen({ navigation }: any) {
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barrioNombre, setBarrioNombre] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const { profile, fetchProfile, space } = useAuthStore();
  const permiteInvitaciones = !space?.space_type || space.space_type === 'residential' || space.space_type === 'club';

  const fetchInvitaciones = async () => {
    const { data, error } = await supabase
      .from('invitaciones')
      .select('*')
      .eq('vecino_id', profile?.id)
      .eq('activo', true)
      .gte('valido_hasta', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvitaciones(data);
    }
  };

  useEffect(() => {
    fetchInvitaciones();
  }, []);

  useEffect(() => {
    const loadQr = async () => {
      if (!profile?.id) return;
      if (profile.qr_code) { setQrCode(profile.qr_code); return; }
      const { data } = await supabase.rpc('obtener_o_generar_qr_miembro', { p_user_id: profile.id });
      if (data) {
        setQrCode(data as string);
        fetchProfile();
      }
    };
    loadQr();
  }, [profile?.id]);

  useEffect(() => {
    const fetchBarrio = async () => {
      if (!profile?.barrio_id) {
        setBarrioNombre(null);
        return;
      }

      const { data, error } = await supabase
        .from('barrios')
        .select('nombre')
        .eq('id', profile.barrio_id)
        .maybeSingle();

      if (!error && data) {
        setBarrioNombre(data.nombre ?? null);
      }
    };

    fetchBarrio();
  }, [profile?.barrio_id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvitaciones();
    setRefreshing(false);
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

  const renderInvitacion = ({ item }: { item: Invitacion }) => (
    <TouchableOpacity
      style={styles.invitacionCard}
      onPress={() => navigation.navigate('DetalleInvitacion', { invitacion: item })}
    >
      <View style={styles.invitacionContent}>
        <Text style={styles.invitadoNombre} numberOfLines={1}>{item.nombre_invitado}</Text>
        <Text style={styles.invitadoDetalle}>
          Válido hasta: {formatDate(item.valido_hasta)}
        </Text>
        <Text style={styles.usosText}>
          Usos: {item.usos_actuales}/{item.usos_permitidos}
        </Text>
      </View>
      <View style={styles.qrIndicator}>
        <Ionicons name="qr-code" size={22} color="#38bdf8" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Inicio" />
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {profile?.nombre?.split(' ')[0]}</Text>
        {barrioNombre && <Text style={styles.barrio}>{barrioNombre}</Text>}
        {profile?.numero_casa && <Text style={styles.casa}>Unidad {profile.numero_casa}</Text>}
      </View>

      {/* QR de acceso del miembro */}
      <TouchableOpacity style={styles.qrBanner} onPress={() => setShowQr(!showQr)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.qrBannerTitle}>🎫 Mi QR de acceso</Text>
          <Text style={styles.qrBannerSub}>Tap para {showQr ? 'ocultar' : 'mostrar'}</Text>
        </View>
        <Ionicons name={showQr ? 'chevron-up' : 'chevron-down'} size={20} color="#3b82f6" />
      </TouchableOpacity>
      {showQr && qrCode && (
        <View style={styles.qrExpanded}>
          <View style={styles.qrBox}>
            <QRCode value={qrCode} size={180} backgroundColor="#ffffff" color="#0f172a" />
          </View>
          <Text style={styles.qrHint}>Mostrá este código en la entrada</Text>
        </View>
      )}

      {permiteInvitaciones && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CrearInvitacion')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Nueva Invitación</Text>
        </TouchableOpacity>
      )}

      {permiteInvitaciones && <Text style={styles.sectionTitle}>Invitaciones Activas</Text>}

      <FlatList
        data={permiteInvitaciones ? invitaciones : []}
        keyExtractor={(item) => item.id}
        renderItem={renderInvitacion}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
          />
        }
        ListEmptyComponent={
          permiteInvitaciones ? (
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={56} color="#334155" />
              <Text style={styles.emptyText}>No tenés invitaciones activas</Text>
              <Text style={styles.emptySubtext}>
                Creá una invitación para que tus visitas puedan ingresar
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  casa: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  qrBannerTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  qrBannerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  qrExpanded: {
    alignItems: 'center',
    paddingBottom: 12,
    marginHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    paddingTop: 16,
  },
  qrBox: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  qrHint: { fontSize: 12, color: '#64748b', marginTop: 10, marginBottom: 6 },
  barrio: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  invitacionCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  invitacionContent: {
    flex: 1,
    padding: 16,
  },
  invitadoNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  invitadoDetalle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  usosText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  qrIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#0f172a',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
