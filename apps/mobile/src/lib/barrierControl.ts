export type BarrierConfig = {
  habilitado: boolean;
  tipo: 'wifi' | 'usb' | null;
  ip_relay: string | null;
  puerto_relay: number;
  endpoint_abrir: string;
  tiempo_abierto_ms: number;
  nombre: string;
};

export type BarrierResult = {
  success: boolean;
  message: string;
};

/**
 * Abre la barrera WiFi enviando un request HTTP al relay
 */
export async function abrirBarreraWifi(config: BarrierConfig): Promise<BarrierResult> {
  if (!config.habilitado || config.tipo !== 'wifi' || !config.ip_relay) {
    return { success: false, message: 'Barrera no configurada' };
  }

  const url = `http://${config.ip_relay}:${config.puerto_relay}${config.endpoint_abrir}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log(`Barrera "${config.nombre}" abierta`);
      return { success: true, message: 'Barrera abierta' };
    } else {
      console.error(`Error abriendo barrera: ${response.status}`);
      return { success: false, message: `Error: ${response.status}` };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Timeout abriendo barrera');
      return { success: false, message: 'Timeout - verificar conexión' };
    }
    console.error('Error abriendo barrera:', error);
    return { success: false, message: 'Error de conexión con la barrera' };
  }
}

/**
 * Intenta abrir la barrera según su configuración
 */
export async function abrirBarrera(config: BarrierConfig | null): Promise<BarrierResult> {
  if (!config || !config.habilitado) {
    return { success: true, message: 'Sin barrera configurada' };
  }

  switch (config.tipo) {
    case 'wifi':
      return abrirBarreraWifi(config);
    case 'usb':
      // USB se maneja desde la app de escritorio/web
      return { success: false, message: 'USB no soportado en móvil' };
    default:
      return { success: false, message: 'Tipo de barrera no reconocido' };
  }
}
