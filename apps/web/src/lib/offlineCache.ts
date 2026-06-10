const DB_NAME = 'qrpass_cache';
const DB_VERSION = 1;
const STORE_QRS = 'qr_codes';
const STORE_PENDING = 'pending_ingresos';

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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_QRS)) {
        db.createObjectStore(STORE_QRS, { keyPath: 'qr_code' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
      }
    };
  });
}

export async function saveQRsToCache(qrs: CachedQR[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QRS, 'readwrite');
  const store = tx.objectStore(STORE_QRS);
  store.clear();
  for (const qr of qrs) store.put(qr);
  return new Promise((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

export async function getQRFromCache(qrCode: string): Promise<CachedQR | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_QRS, 'readonly');
  const store = tx.objectStore(STORE_QRS);
  return new Promise((res, rej) => {
    const request = store.get(qrCode);
    request.onsuccess = () => { db.close(); res(request.result || null); };
    request.onerror = () => { db.close(); rej(request.error); };
  });
}

export async function getCacheCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_QRS, 'readonly');
  const store = tx.objectStore(STORE_QRS);
  return new Promise((res, rej) => {
    const request = store.count();
    request.onsuccess = () => { db.close(); res(request.result); };
    request.onerror = () => { db.close(); rej(request.error); };
  });
}

export async function savePendingIngreso(ingreso: PendingIngreso): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, 'readwrite');
  tx.objectStore(STORE_PENDING).put(ingreso);
  return new Promise((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

export async function getPendingIngresos(): Promise<PendingIngreso[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, 'readonly');
  const store = tx.objectStore(STORE_PENDING);
  return new Promise((res, rej) => {
    const request = store.getAll();
    request.onsuccess = () => { db.close(); res(request.result); };
    request.onerror = () => { db.close(); rej(request.error); };
  });
}

export async function removePendingIngreso(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, 'readwrite');
  tx.objectStore(STORE_PENDING).delete(id);
  return new Promise((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

export async function clearPendingIngresos(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, 'readwrite');
  tx.objectStore(STORE_PENDING).clear();
  return new Promise((res, rej) => {
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}