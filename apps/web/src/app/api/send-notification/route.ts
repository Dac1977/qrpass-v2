import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { to, title, body, data } = await request.json();

    if (!to) {
      return NextResponse.json({ error: 'Token push requerido' }, { status: 400 });
    }

    const message = {
      to,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    console.log('🚀 [API] Enviando notificación push:', { to: to.substring(0, 20) + '...', title, body });

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
      console.error('❌ [API] Expo push error:', response.status, JSON.stringify(responseBody));
      return NextResponse.json({ 
        error: 'Error enviando notificación', 
        details: responseBody 
      }, { status: response.status });
    } else {
      const ticket = responseBody?.data;
      if (ticket?.status === 'error') {
        console.error('❌ [API] Expo push ticket error:', ticket.message, 'details:', JSON.stringify(ticket.details));
        return NextResponse.json({ 
          error: 'Error en ticket de notificación', 
          details: ticket 
        }, { status: 400 });
      } else {
        console.log('✅ [API] Expo push OK - ticket:', JSON.stringify(responseBody));
        return NextResponse.json({ 
          success: true, 
          ticket: responseBody 
        });
      }
    }
  } catch (error) {
    console.error('💥 [API] Error enviando push notification:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 });
  }
}
