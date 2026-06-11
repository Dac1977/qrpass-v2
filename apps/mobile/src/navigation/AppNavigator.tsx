import React, { useEffect } from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { VecinoNavigator } from './VecinoNavigator';
import { GuardiaNavigator } from './GuardiaNavigator';
import { AdminNavigator } from './AdminNavigator';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { authApi } from '../lib/api';

export function AppNavigator() {
  const { token, profile, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    const syncPushToken = async () => {
      if (!token || !profile?.id) return;

      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && pushToken !== profile.expoPushToken) {
          await authApi.updatePushToken(pushToken);
          await useAuthStore.getState().fetchProfile();
        }
      } catch (error) {
        console.error('Error syncing push token:', error);
      }
    };

    syncPushToken();
  }, [token, profile?.id, profile?.expoPushToken]);

  if (!initialized || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const getNavigator = () => {
    if (!token) {
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
