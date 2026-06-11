import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminUsuariosScreen } from '../screens/admin/AdminUsuariosScreen';
import { AdminIngresosScreen } from '../screens/admin/AdminIngresosScreen';
import { AdminGestionScreen } from '../screens/admin/AdminGestionScreen';
import { AdminExpensasScreen } from '../screens/admin/AdminExpensasScreen';
import { AdminAmenitiesScreen } from '../screens/admin/AdminAmenitiesScreen';
import { AdminEncuestasScreen } from '../screens/admin/AdminEncuestasScreen';
import { AdminReclamosScreen } from '../screens/admin/AdminReclamosScreen';
import { AdminAccesosScreen } from '../screens/admin/AdminAccesosScreen';
import { PerfilScreen } from '../screens/vecino/PerfilScreen';
import { JoinSpaceScreen } from '../screens/vecino/JoinSpaceScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="UsuariosTab"
        component={AdminUsuariosScreen}
        options={{
          tabBarLabel: 'Usuarios',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="IngresosTab"
        component={AdminIngresosScreen}
        options={{
          tabBarLabel: 'Ingresos',
          tabBarIcon: ({ color }) => (
            <Ionicons name="enter" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GestionTab"
        component={AdminGestionScreen}
        options={{
          tabBarLabel: 'Gestión',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PerfilTab"
        component={PerfilScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f1f5f9',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="AdminHome"
        component={AdminTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminExpensas"
        component={AdminExpensasScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminAmenities"
        component={AdminAmenitiesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminEncuestas"
        component={AdminEncuestasScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminReclamos"
        component={AdminReclamosScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminAccesos"
        component={AdminAccesosScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JoinSpace"
        component={JoinSpaceScreen}
        options={{ title: 'Unirse a un espacio' }}
      />
    </Stack.Navigator>
  );
}
