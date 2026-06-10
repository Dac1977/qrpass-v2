export type BarrierConfig = {
  habilitado: boolean;
  tipo: 'wifi' | 'usb' | null;
  ip_relay: string | null;
  puerto_relay: number;
  endpoint_abrir: string;
  tiempo_abierto_ms: number;
  nombre: string;
  puerto_usb?: string | null;
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
 * Abre barrera USB usando Web Serial API (solo Chrome/Edge)
 * El relay USB típicamente se activa enviando un byte específico
 */
export async function abrirBarreraUSB(config: BarrierConfig): Promise<BarrierResult> {
  if (!config.habilitado || config.tipo !== 'usb') {
    return { success: false, message: 'Barrera USB no configurada' };
  }

  if (!('serial' in navigator)) {
    return { success: false, message: 'Web Serial API no soportada en este navegador' };
  }

  try {
    // @ts-ignore - Web Serial API
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    
    const writer = port.writable.getWriter();
    // Comando típico para activar relay: 0xA0 0x01 0x01 0xA2 (encender canal 1)
    const command = new Uint8Array([0xA0, 0x01, 0x01, 0xA2]);
    await writer.write(command);
    
    // Esperar tiempo configurado y apagar
    await new Promise(resolve => setTimeout(resolve, config.tiempo_abierto_ms));
    
    // Comando para apagar: 0xA0 0x01 0x00 0xA1
    const offCommand = new Uint8Array([0xA0, 0x01, 0x00, 0xA1]);
    await writer.write(offCommand);
    
    writer.releaseLock();
    await port.close();
    
    console.log(`Barrera USB "${config.nombre}" abierta`);
    return { success: true, message: 'Barrera abierta' };
  } catch (error: any) {
    console.error('Error abriendo barrera USB:', error);
    return { success: false, message: error.message || 'Error con barrera USB' };
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
      return abrirBarreraUSB(config);
    default:
      return { success: false, message: 'Tipo de barrera no reconocido' };
  }
}
