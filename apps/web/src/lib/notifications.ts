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
