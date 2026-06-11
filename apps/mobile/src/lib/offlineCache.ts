import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'qrpass_qr_cache';
const PENDING_KEY = 'qrpass_pending_ingresos';

export type CachedQR = {
  qr_code: string;
  tipo: 'invitado' | 'vecino' | 'personal';
  nombre: string | null;
  dni: string | null;
  numero_casa: string | null;
  vecino_nombre: string | null;
  invitacion_id: string | null;
  personal_id: string | null;
  profile_id: string | null;
};

export type PendingIngreso = {
  id: string;
  barrio_id: string;
  guardia_id: string;
  invitacion_id: string | null;
  personal_id: string | null;
  nombre_visitante: string | null;
  dni_visitante: string | null;
  casa_destino: string | null;
  tipo: string;
  estado: string;
  created_at: string;
};

export async function saveQRsToCache(qrs: CachedQR[]): Promise<void> {
  const map: Record<string, CachedQR> = {};
  for (const qr of qrs) {
    map[qr.qr_code] = qr;
  }
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

export async function getQRFromCache(qrCode: string): Promise<CachedQR | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, CachedQR>;
  return map[qrCode] || null;
}

export async function getCacheCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return 0;
  return Object.keys(JSON.parse(raw)).length;
}

export async function savePendingIngreso(ingreso: PendingIngreso): Promise<void> {
  const pending = await getPendingIngresos();
  pending.push(ingreso);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function getPendingIngresos(): Promise<PendingIngreso[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as PendingIngreso[];
}

export async function removePendingIngreso(id: string): Promise<void> {
  const pending = await getPendingIngresos();
  const filtered = pending.filter((p) => p.id !== id);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
}

export async function clearPendingIngresos(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY);
}
