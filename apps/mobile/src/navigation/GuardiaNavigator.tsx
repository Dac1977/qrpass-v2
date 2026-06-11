import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScannerScreen } from '../screens/guardia/ScannerScreen';
import { HistorialScreen } from '../screens/guardia/HistorialScreen';
import { PerfilScreen } from '../screens/vecino/PerfilScreen';
import { JoinSpaceScreen } from '../screens/vecino/JoinSpaceScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function GuardiaTabs() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#16213e',
          borderTopColor: '#0f3460',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Escanear',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>📷</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Historial"
        component={HistorialScreen}
        options={{
          tabBarLabel: 'Historial',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function GuardiaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#16213e' },
        headerTintColor: '#f1f5f9',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="GuardiaHome" component={GuardiaTabs} options={{ headerShown: false }} />
      <Stack.Screen name="JoinSpace" component={JoinSpaceScreen} options={{ title: 'Unirse a un espacio' }} />
    </Stack.Navigator>
  );
}
