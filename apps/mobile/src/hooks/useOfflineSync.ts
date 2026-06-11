import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import {
  saveQRsToCache,
  getQRFromCache,
  getCacheCount,
  savePendingIngreso,
  getPendingIngresos,
  removePendingIngreso,
  type CachedQR,
  type PendingIngreso,
} from '../lib/offlineCache';
import uuid from 'react-native-uuid';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function useOfflineSync(barrioId: string | null) {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheCount, setCacheCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const syncQRs = useCallback(async () => {
    if (!barrioId) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('get_qrs_for_cache', {
        p_barrio_id: barrioId,
      });

      if (error) {
        console.error('Error syncing QRs:', error);
        return;
      }

      const qrs: CachedQR[] = (data || []).map((item: any) => ({
        qr_code: item.qr_code,
        tipo: item.tipo,
        nombre: item.nombre,
        dni: item.dni,
        numero_casa: item.numero_casa,
        vecino_nombre: item.vecino_nombre,
        invitacion_id: item.invitacion_id,
        personal_id: item.personal_id,
        profile_id: item.profile_id,
      }));

      await saveQRsToCache(qrs);
      const count = await getCacheCount();
      setCacheCount(count);
      console.log(`Synced ${count} QRs to cache`);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }, [barrioId]);

  const syncPendingIngresos = useCallback(async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    const pending = await getPendingIngresos();
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} pending ingresos...`);

    for (const ingreso of pending) {
      const { id, ...data } = ingreso;
      const { error } = await supabase.from('ingresos').insert(data);

      if (!error) {
        await removePendingIngreso(id);
        console.log(`Synced ingreso ${id}`);
      } else {
        console.error(`Error syncing ingreso ${id}:`, error);
      }
    }

    const remaining = await getPendingIngresos();
    setPendingCount(remaining.length);
  }, []);

  const validateOffline = useCallback(async (qrCode: string): Promise<CachedQR | null> => {
    return getQRFromCache(qrCode);
  }, []);

  const queueIngreso = useCallback(async (ingreso: Omit<PendingIngreso, 'id' | 'created_at'>) => {
    const pendingIngreso: PendingIngreso = {
      ...ingreso,
      id: uuid.v4() as string,
      created_at: new Date().toISOString(),
    };
    await savePendingIngreso(pendingIngreso);
    const pending = await getPendingIngresos();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online) {
        syncQRs();
        syncPendingIngresos();
      }
    });

    return () => unsubscribe();
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
    syncing,
    syncQRs,
    validateOffline,
    queueIngreso,
  };
}
