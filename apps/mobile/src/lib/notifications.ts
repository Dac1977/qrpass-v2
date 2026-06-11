import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getProjectId = () => {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.slug
  );
};

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissions not granted');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('EAS project ID not found. Unable to register for push notifications.');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token.data;
}

export async function sendPushNotification(
  to: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const message = {
      to,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch (parseError) {
      responseBody = await response.text();
    }

    if (!response.ok) {
      console.error('Expo push error:', response.status, JSON.stringify(responseBody));
    } else {
      const ticket = responseBody?.data;
      if (ticket?.status === 'error') {
        console.error('Expo push ticket error:', ticket.message, 'details:', JSON.stringify(ticket.details));
      } else {
        console.log('Expo push OK - ticket:', JSON.stringify(responseBody));
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
