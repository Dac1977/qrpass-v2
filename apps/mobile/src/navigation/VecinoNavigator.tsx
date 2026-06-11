import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { HomeScreen } from '../screens/vecino/HomeScreen';
import { CrearInvitacionScreen } from '../screens/vecino/CrearInvitacionScreen';
import { DetalleInvitacionScreen } from '../screens/vecino/DetalleInvitacionScreen';
import { ContactosScreen } from '../screens/vecino/ContactosScreen';
import { PerfilScreen } from '../screens/vecino/PerfilScreen';
import { AvisosScreen } from '../screens/vecino/AvisosScreen';
import { CrearAvisoScreen } from '../screens/vecino/CrearAvisoScreen';
import { DetalleAvisoScreen } from '../screens/vecino/DetalleAvisoScreen';
import { PersonalScreen } from '../screens/vecino/PersonalScreen';
import { RegistrarPersonalScreen } from '../screens/vecino/RegistrarPersonalScreen';
import { DetallePersonalScreen } from '../screens/vecino/DetallePersonalScreen';
import { EditarPersonalScreen } from '../screens/vecino/EditarPersonalScreen';
import { ExpensasScreen } from '../screens/vecino/ExpensasScreen';
import { EventosScreen } from '../screens/vecino/EventosScreen';
import { CrearEventoScreen } from '../screens/vecino/CrearEventoScreen';
import { DetalleEventoScreen } from '../screens/vecino/DetalleEventoScreen';
import { AmenitiesScreen } from '../screens/vecino/AmenitiesScreen';
import { EncuestasScreen } from '../screens/vecino/EncuestasScreen';
import { ReclamosScreen } from '../screens/vecino/ReclamosScreen';
import { MasScreen } from '../screens/vecino/MasScreen';
import { DeliveryScreen } from '../screens/vecino/DeliveryScreen';
import FaceRegistrationScreen from '../screens/FaceRegistrationScreen';
import { MiCasaScreen } from '../screens/vecino/MiCasaScreen';
import { JoinSpaceScreen } from '../screens/vecino/JoinSpaceScreen';
import { getSpaceLabels } from '../utils/spaceLabels';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const EXPENSAS_LABEL: Record<string, string> = {
  residential: 'Expensas', gym: 'Cuotas', club: 'Cuotas',
  coworking: 'Alquiler', event: 'Tickets', other: 'Pagos',
};

function HomeTabs() {
  const insets = useSafeAreaInsets();
  const { profile, space } = useAuthStore();
  const labels = getSpaceLabels(space?.space_type);
  const esTitular = profile?.es_titular ?? true;
  const expensasLabel = labels.payments;

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
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AvisosTab"
        component={AvisosScreen}
        options={{
          tabBarLabel: 'Cartelera',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone" size={22} color={color} />
          ),
        }}
      />
      {esTitular && (
        <Tab.Screen
          name="ExpensasTab"
          component={ExpensasScreen}
          options={{
            tabBarLabel: expensasLabel,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cash" size={22} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="MasTab"
        component={MasScreen}
        options={{
          tabBarLabel: 'Más',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PerfilTab"
        component={PerfilScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function VecinoNavigator() {
  const { space } = useAuthStore();
  const labels = getSpaceLabels(space?.space_type);
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f1f5f9',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CrearInvitacion"
        component={CrearInvitacionScreen}
        options={{ title: 'Nueva Invitación' }}
      />
      <Stack.Screen
        name="DetalleInvitacion"
        component={DetalleInvitacionScreen}
        options={{ title: 'Invitación' }}
      />
      <Stack.Screen
        name="CrearAviso"
        component={CrearAvisoScreen}
        options={{ title: 'Nuevo Aviso' }}
      />
      <Stack.Screen
        name="DetalleAviso"
        component={DetalleAvisoScreen}
        options={{ title: 'Aviso' }}
      />
      <Stack.Screen
        name="RegistrarPersonal"
        component={RegistrarPersonalScreen}
        options={{ title: 'Registrar Personal' }}
      />
      <Stack.Screen
        name="DetallePersonal"
        component={DetallePersonalScreen}
        options={{ title: 'Detalle Personal' }}
      />
      <Stack.Screen
        name="EditarPersonal"
        component={EditarPersonalScreen}
        options={{ title: 'Editar Personal' }}
      />
      <Stack.Screen
        name="Eventos"
        component={EventosScreen}
        options={{ title: 'Eventos' }}
      />
      <Stack.Screen
        name="CrearEvento"
        component={CrearEventoScreen}
        options={{ title: 'Nuevo Evento' }}
      />
      <Stack.Screen
        name="DetalleEvento"
        component={DetalleEventoScreen}
        options={{ title: 'Detalle Evento' }}
      />
      <Stack.Screen
        name="Amenities"
        component={AmenitiesScreen}
        options={{ title: 'Amenities' }}
      />
      <Stack.Screen
        name="Encuestas"
        component={EncuestasScreen}
        options={{ title: 'Encuestas' }}
      />
      <Stack.Screen
        name="Reclamos"
        component={ReclamosScreen}
        options={{ title: 'Reclamos' }}
      />
      <Stack.Screen
        name="PersonalTab"
        component={PersonalScreen}
        options={{ title: 'Personal' }}
      />
      <Stack.Screen
        name="Contactos"
        component={ContactosScreen}
        options={{ title: 'Contactos' }}
      />
      <Stack.Screen
        name="Delivery"
        component={DeliveryScreen}
        options={{ title: 'Delivery Rápido' }}
      />
      <Stack.Screen
        name="MiCasa"
        component={MiCasaScreen}
        options={{ title: labels.myUnit }}
      />
      <Stack.Screen
        name="FaceRegistration"
        component={FaceRegistrationScreen}
        options={{ 
          title: 'Registro Facial',
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="JoinSpace"
        component={JoinSpaceScreen}
        options={{ title: 'Unirse a un espacio' }}
      />
    </Stack.Navigator>
  );
}
