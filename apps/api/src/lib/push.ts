type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendPushNotification(tokens: string[], payload: PushPayload) {
  const messages = tokens
    .filter((t) => t.startsWith('ExponentPushToken'))
    .map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
    }));

  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('Push notification error:', err);
  }
}
