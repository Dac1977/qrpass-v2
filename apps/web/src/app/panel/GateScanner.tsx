'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { abrirBarrera, type BarrierConfig } from '@/lib/barrierControl';
import jsQR from 'jsqr';

export type GateBarrera = {
  habilitado: boolean;
  tipo: 'ip_relay' | 'relay_usb' | 'ninguna';
  ip: string;
  puerto: number;
  endpoint_abrir: string;
  auth_token: string;
};

export type Gate = {
  id: string;
  nombre: string;
  tipo: 'IN' | 'OUT' | 'BOTH';
  barrera: GateBarrera | null;
  orden: number;
};

type ScanStatus = 'idle' | 'ok_entrada' | 'ok_salida' | 'error';

function toBarrierConfig(b: GateBarrera): BarrierConfig {
  return {
    habilitado: b.habilitado,
    tipo: b.tipo === 'ip_relay' ? 'wifi' : b.tipo === 'relay_usb' ? 'usb' : null,
    ip_relay: b.ip || null,
    puerto_relay: b.puerto,
    endpoint_abrir: b.endpoint_abrir,
    tiempo_abierto_ms: 3000,
    nombre: 'Barrera',
  };
}

export function GateScanner({
  gate,
  barrioId,
  guardiaId,
  cameraIndex = 0,
}: {
  gate: Gate;
  barrioId: string;
  guardiaId: string;
  cameraIndex?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const videoDevices = devs.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices[cameraIndex]) {
        setSelectedDeviceId(videoDevices[cameraIndex].deviceId);
      } else if (videoDevices[0]) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    });
  }, [cameraIndex]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    let active = true;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraError('No se pudo acceder a la cámara');
      }
    };

    initCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [selectedDeviceId]);

  const showStatus = useCallback((s: ScanStatus, msg: string) => {
    setStatus(s);
    setStatusMsg(msg);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => {
      setStatus('idle');
      setStatusMsg(null);
    }, 4000);
  }, []);

  const processQr = useCallback(async (qrCode: string) => {
    if (!barrioId || !guardiaId || scanLockRef.current) return;
    scanLockRef.current = true;

    try {
      const tipo = gate.tipo === 'OUT' ? 'salida' : 'entrada';
      const result = await api.accesos.verificar({ qrCode, spaceId: barrioId, tipo });

      if (result.autorizado) {
        const nombre = result.usuario?.nombre ?? 'visitante';
        if (gate.barrera?.habilitado) abrirBarrera(toBarrierConfig(gate.barrera));
        if (tipo === 'salida') {
          showStatus('ok_salida', `Salida: ${nombre}`);
        } else {
          showStatus('ok_entrada', `Entrada: ${nombre}`);
        }
      } else {
        showStatus('error', result.motivo ?? 'Acceso denegado');
      }
    } catch {
      showStatus('error', 'Error al validar QR');
    } finally {
      setTimeout(() => { scanLockRef.current = false; }, 3500);
    }
  }, [barrioId, guardiaId, gate, showStatus]);

  // Scan loop (throttled to every 300ms)
  useEffect(() => {
    let animId: number;
    let lastScanMs = 0;

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const now = Date.now();
        if (now - lastScanMs > 300) {
          lastScanMs = now;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code?.data) processQr(code.data);
          }
        }
      }
      animId = requestAnimationFrame(scan);
    };

    animId = requestAnimationFrame(scan);
    return () => {
      cancelAnimationFrame(animId);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, [processQr]);

  const gateIcon = gate.tipo === 'IN' ? '🟢' : gate.tipo === 'OUT' ? '🔴' : '🔵';
  const gateLabel = gate.tipo === 'IN' ? 'Solo Entrada' : gate.tipo === 'OUT' ? 'Solo Salida' : 'Entrada y Salida';
  const statusBg = status === 'ok_entrada' ? '#16a34a' : status === 'ok_salida' ? '#2563eb' : '#dc2626';
  const statusIcon = status === 'ok_entrada' ? '✅' : status === 'ok_salida' ? '🚪' : '❌';

  return (
    <div style={{ background: '#0f172a', borderRadius: 16, overflow: 'hidden', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', background: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{gateIcon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 700, margin: 0, fontSize: 14 }}>{gate.nombre}</p>
          <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{gateLabel}</p>
        </div>
        {devices.length > 1 && (
          <select
            style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, padding: '2px 6px' }}
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>Cámara {i + 1}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ position: 'relative', aspectRatio: '4/3', background: '#000' }}>
        {cameraError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{cameraError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted autoPlay />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}

        {status !== 'idle' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: statusBg + 'ee',
          }}>
            <p style={{ fontSize: 40, margin: 0 }}>{statusIcon}</p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '8px 0 0', textAlign: 'center', padding: '0 12px' }}>{statusMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
