import React, { useEffect } from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { VecinoNavigator } from './VecinoNavigator';
import { GuardiaNavigator } from './GuardiaNavigator';
import { AdminNavigator } from './AdminNavigator';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export function AppNavigator() {
  const { session, profile, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    const syncPushToken = async () => {
      if (!session || !profile?.id) return;

      try {
        const token = await registerForPushNotificationsAsync();
        if (token && token !== profile.expo_push_token) {
          await supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('id', profile.id);
          await useAuthStore.getState().fetchProfile();
        }
      } catch (error) {
        console.error('Error syncing push token:', error);
      }
    };

    syncPushToken();
  }, [session, profile?.id, profile?.expo_push_token]);

  if (!initialized || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const getNavigator = () => {
    if (!session) {
      return <AuthNavigator />;
    }

    switch (profile?.rol) {
      case 'guardia':
        return <GuardiaNavigator />;
      case 'admin':
        return <AdminNavigator />;
      case 'vecino':
      default:
        return <VecinoNavigator />;
    }
  };

  const linking: LinkingOptions<any> = {
    prefixes: ['qrpass://', 'https://qrpass.app'],
    config: {
      screens: {
        Login: 'login',
        JoinSpace: {
          path: 'join/:codigo',
          parse: { codigo: (codigo: string) => codigo.toUpperCase() },
        },
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {getNavigator()}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
