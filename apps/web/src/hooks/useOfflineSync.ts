'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
// TODO: reemplazar cuando haya endpoints de cache offline en la nueva API
import {
  getQRFromCache,
  getCacheCount,
  savePendingIngreso,
  getPendingIngresos,
  type CachedQR,
  type PendingIngreso,
} from '@/lib/offlineCache';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function useOfflineSync(barrioId: string | null) {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheCount, setCacheCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const syncQRs = useCallback(async () => {
    // TODO: implementar endpoint GET /accesos/qrs-cache?spaceId=... en la nueva API
    if (!barrioId || !navigator.onLine) return;
    setSyncing(true);
    try {
      const count = await getCacheCount();
      setCacheCount(count);
      setLastSync(new Date());
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }, [barrioId]);

  const syncPendingIngresos = useCallback(async () => {
    // TODO: implementar sync de ingresos pendientes vía nueva API
    if (!navigator.onLine) return;
    const remaining = await getPendingIngresos();
    setPendingCount(remaining.length);
  }, []);

  const validateOffline = useCallback(async (qrCode: string): Promise<CachedQR | null> => {
    return getQRFromCache(qrCode);
  }, []);

  const queueIngreso = useCallback(async (ingreso: Omit<PendingIngreso, 'id' | 'created_at'>) => {
    const pendingIngreso: PendingIngreso = {
      ...ingreso,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    await savePendingIngreso(pendingIngreso);
    const pending = await getPendingIngresos();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQRs();
      syncPendingIngresos();
    };
    
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQRs, syncPendingIngresos]);

  useEffect(() => {
    if (!barrioId) return;

    syncQRs();
    
    getCacheCount().then(setCacheCount);
    getPendingIngresos().then((p) => setPendingCount(p.length));

    intervalRef.current = setInterval(syncQRs, SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [barrioId, syncQRs]);

  return {
    isOnline,
    cacheCount,
    pendingCount,
    lastSync,
    syncing,
    syncQRs,
    validateOffline,
    queueIngreso,
  };
}
