import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const message = await request.json();

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch (parseError) {
      responseBody = await response.text();
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Expo push error',
          status: response.status,
          details: responseBody,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('API push error:', error);
    return NextResponse.json(
      {
        error: 'Failed to proxy push notification',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
