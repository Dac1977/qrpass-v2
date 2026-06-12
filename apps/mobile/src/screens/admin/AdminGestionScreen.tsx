import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/AppHeader';
import { spacesApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const menuItems = [
  { key: 'AdminExpensas', icon: 'cash-outline', color: '#22c55e', title: 'Expensas', desc: 'Gestionar expensas y pagos' },
  { key: 'AdminAmenities', icon: 'fitness-outline', color: '#3b82f6', title: 'Amenities', desc: 'Gestionar amenities y reservas' },
  { key: 'AdminEncuestas', icon: 'bar-chart-outline', color: '#8b5cf6', title: 'Encuestas', desc: 'Crear y ver encuestas' },
  { key: 'AdminReclamos', icon: 'warning-outline', color: '#f59e0b', title: 'Reclamos', desc: 'Gestionar reclamos de vecinos' },
  { key: 'AdminAccesos', icon: 'git-branch-outline', color: '#06b6d4', title: 'Terminales y Accesos', desc: 'Configurar terminales, gates y barreras' },
];

export function AdminGestionScreen() {
  const navigation = useNavigation<any>();
  const { space } = useAuthStore();
  const [registrarSalidas, setRegistrarSalidas] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (space?.registrarSalidas !== undefined) {
      setRegistrarSalidas(space.registrarSalidas);
    }
  }, [space?.registrarSalidas]);

  const toggleSalidas = async (value: boolean) => {
    if (!space?.id) return;
    setLoading(true);
    try {
      await spacesApi.actualizar(space.id, { registrarSalidas: value });
      setRegistrarSalidas(value);
      Alert.alert('Éxito', 'Configuración actualizada');
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      Alert.alert('Error', 'No se pudo actualizar la configuración');
      setRegistrarSalidas(!value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Gestión" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Administración del barrio</Text>

        <View style={styles.configSection}>
          <Text style={styles.configHeader}>⚙️ Configuración</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Registrar salidas</Text>
              <Text style={styles.switchDesc}>El guardia podrá registrar la salida al escanear un QR ya ingresado</Text>
            </View>
            <Switch
              value={registrarSalidas}
              onValueChange={toggleSalidas}
              trackColor={{ false: '#334155', true: '#3b82f6' }}
              thumbColor={registrarSalidas ? '#fff' : '#94a3b8'}
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Módulos</Text>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.key} style={styles.menuItem} onPress={() => navigation.navigate(item.key)}>
            <View style={[styles.iconCircle, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon as any} size={24} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#475569" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  configSection: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 20 },
  configHeader: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  switchDesc: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 14, padding: 16, marginBottom: 10, gap: 14,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  menuDesc: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
});
