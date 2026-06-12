import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { personalApi, PersonalPermanente } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export function PersonalScreen({ navigation }: any) {
  const [personal, setPersonal] = useState<PersonalPermanente[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPersonal = useCallback(async () => {
    try {
      const { personal: data } = await personalApi.mis();
      setPersonal(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      setPersonal([]);
    }
  }, []);

  useEffect(() => {
    fetchPersonal();
  }, [fetchPersonal]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPersonal();
    });
    return unsubscribe;
  }, [navigation, fetchPersonal]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPersonal();
    setRefreshing(false);
  };

  const renderPersonal = ({ item }: { item: PersonalPermanente }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DetallePersonal', { personalId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        {item.foto ? (
          <Image source={{ uri: item.foto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={28} color="#64748b" />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardNombre} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.cardDni} numberOfLines={1}>DNI: {item.dni}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="calendar-outline" size={12} color="#38bdf8" />
              <Text style={styles.badgeText}>{item.permisos.length} días</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#475569" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Personal Doméstico</Text>
        <Text style={styles.subtitle}>Gestioná el personal que ingresa a tu casa</Text>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('RegistrarPersonal')}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
        <Text style={styles.addButtonText}>Registrar Personal</Text>
      </TouchableOpacity>

      <FlatList
        data={personal}
        keyExtractor={(item) => item.id}
        renderItem={renderPersonal}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color="#334155" />
            <Text style={styles.emptyText}>Sin personal registrado</Text>
            <Text style={styles.emptySubtext}>
              Registrá personal para que puedan ingresar al espacio con su QR
            </Text>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  cardNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  cardDni: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '500',
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
