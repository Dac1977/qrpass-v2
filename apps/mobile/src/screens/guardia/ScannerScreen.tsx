import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Vibration,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { accesosApi, ValidacionQR, invitacionesApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { abrirBarrera, type BarrierConfig } from '../../lib/barrierControl';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

const { width, height } = Dimensions.get('window');

type EstadoValidacion = 'idle' | 'autorizado' | 'rechazado' | 'pendiente';
type CameraMode = 'qr' | 'face';

export function ScannerScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);
  const [cameraMode, setCameraMode] = useState<'qr' | 'face'>('qr');
  const [estado, setEstado] = useState<EstadoValidacion>('idle');
  const [resultado, setResultado] = useState<ValidacionQR | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const { space } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [faceDetectionActive, setFaceDetectionActive] = useState(false);
  const processingFace = useRef(false);
  const [barrierConfig, setBarrierConfig] = useState<BarrierConfig | null>(null);
  const [habilitarReconocimientoFacial, setHabilitarReconocimientoFacial] = useState(false);
  const [registrarSalidas, setRegistrarSalidas] = useState(false);
  const [gates, setGates] = useState<{ id: string; nombre: string; tipo: 'IN' | 'OUT' | 'BOTH' }[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [showGatePicker, setShowGatePicker] = useState(false);
  const [showSalidaModal, setShowSalidaModal] = useState(false);
  const [ingresoAbierto, setIngresoAbierto] = useState<string | null>(null);
  const ingresoAbiertoRef = useRef<string | null>(null);
  const [showCorregirSalidaModal, setShowCorregirSalidaModal] = useState(false);
  const [salidaPrevio, setSalidaPrevio] = useState<string | null>(null);
  const [ingresoIdCorregir, setIngresoIdCorregir] = useState<string | null>(null);
  const [salidaCountdown, setSalidaCountdown] = useState(10);
  const salidaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const salidaCountRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar configuración de barrera y reconocimiento facial
  useEffect(() => {
    if (!space?.id) return;
    // Stub: configuración de barrera, reconocimiento facial y gates no están en la API aún
    setBarrierConfig(null);
    setHabilitarReconocimientoFacial(false);
    setRegistrarSalidas(false);
    setGates([]);
  }, [space?.id]);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'none',
  });

  const cameraRef = useRef<Camera>(null);

  const onFaceDetected = Worklets.createRunOnJS(() => {
    if (processingFace.current || !cameraRef.current) return;
    processingFace.current = true;
    setFaceDetectionActive(true);
    cameraRef.current.takeSnapshot({ quality: 80 })
      .then((snap) => processFaceWithImage(snap.path))
      .catch(() => { processingFace.current = false; setFaceDetectionActive(false); });
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (processingFace.current) return;
    const faces = detectFaces(frame);
    if (faces.length > 0) {
      const face = faces[0];
      const area = (face.bounds.width * face.bounds.height) / (frame.width * frame.height);
      if (area > 0.04) onFaceDetected();
    }
  }, [detectFaces, onFaceDetected]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const resetScanner = () => {
    setScanned(false);
    setEstado('idle');
    setResultado(null);
    setFaceDetectionActive(false);
    processingFace.current = false;
    setShowSalidaModal(false);
    setShowCorregirSalidaModal(false);
    setIngresoAbierto(null);
    setSalidaPrevio(null);
    setIngresoIdCorregir(null);
    setSalidaCountdown(10);
    if (salidaTimerRef.current) { clearTimeout(salidaTimerRef.current); salidaTimerRef.current = null; }
    if (salidaCountRef.current) { clearInterval(salidaCountRef.current); salidaCountRef.current = null; }
  };

  const startSalidaTimer = () => {
    setSalidaCountdown(10);
    salidaCountRef.current = setInterval(() => {
      setSalidaCountdown(prev => {
        if (prev <= 1) {
          if (salidaCountRef.current) clearInterval(salidaCountRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    salidaTimerRef.current = setTimeout(() => {
      if (salidaCountRef.current) clearInterval(salidaCountRef.current);
      registrarSalida(ingresoAbiertoRef.current ?? undefined);
    }, 10000);
  };

  const registrarSalida = async (idOverride?: string) => {
    const id = idOverride ?? ingresoAbiertoRef.current;
    if (!id) {
      resetScanner();
      return;
    }
    if (salidaTimerRef.current) { clearTimeout(salidaTimerRef.current); salidaTimerRef.current = null; }
    if (salidaCountRef.current) { clearInterval(salidaCountRef.current); salidaCountRef.current = null; }
    try {
      await accesosApi.registrarSalida(id);
      ingresoAbiertoRef.current = null;
      setShowSalidaModal(false);
      setEstado('autorizado');
      setResultado(prev => prev ? { ...prev, mensaje: 'Salida registrada ✓' } : prev);
      timeoutRef.current = setTimeout(resetScanner, 3000);
    } catch (error) {
      console.error('Error registrando salida:', error);
      Alert.alert('Error', 'No se pudo registrar la salida');
      resetScanner();
    }
  };

  const corregirSalida = async () => {
    if (!ingresoIdCorregir) {
      resetScanner();
      return;
    }
    try {
      await accesosApi.registrarSalida(ingresoIdCorregir);
      setShowCorregirSalidaModal(false);
      setEstado('autorizado');
      setResultado(prev => prev ? { ...prev, mensaje: 'Hora de salida actualizada ✓' } : prev);
      timeoutRef.current = setTimeout(resetScanner, 3000);
    } catch (error) {
      console.error('Error corrigiendo salida:', error);
      Alert.alert('Error', 'No se pudo actualizar la salida');
      resetScanner();
    }
  };

  const checkIngresoAbierto = async (_invitacion_id: string | null, _personal_id: string | null): Promise<string | null> => {
    return null;
  };

  const checkSalidaHoy = async (_invitacion_id: string | null, _personal_id: string | null): Promise<{ id: string; salida_at: string } | null> => {
    return null;
  };

  const processFaceWithImage = async (imagePath: string) => {
    try {
      const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });
      await processFaceValidation(base64);
    } catch (error) {
      console.error('Error leyendo imagen:', error);
      processingFace.current = false;
      setFaceDetectionActive(false);
    }
  };

  const processFaceValidation = async (_imageBase64: string) => {
    Vibration.vibrate(100);
    Alert.alert('Próximamente', 'El reconocimiento facial estará disponible pronto.');
    setEstado('rechazado');
    setResultado({
      tipo: 'reconocimiento_facial',
      estado: 'rechazado',
      nombre: null,
      dni: null,
      vecino_nombre: null,
      numeroCasa: null,
      invitacion_id: null,
      personal_id: null,
      mensaje: 'No disponible',
    });
    timeoutRef.current = setTimeout(resetScanner, 4000);
    setFaceDetectionActive(false);
    processingFace.current = false;
  };


  const resolverPendiente = (nuevoEstado: 'autorizado' | 'rechazado') => {
    if (!resultado) return;
    const resultadoFinal: ValidacionQR = {
      ...resultado,
      estado: nuevoEstado,
      mensaje: nuevoEstado === 'autorizado'
        ? 'Autorizado por guardia (fuera de horario)'
        : 'Rechazado por guardia',
    };
    setEstado(nuevoEstado);
    setResultado(resultadoFinal);
    timeoutRef.current = setTimeout(resetScanner, 4000);
  };

  const currentGate = gates.find(g => g.id === selectedGateId) ?? null;
  const currentGateTipo: 'IN' | 'OUT' | 'BOTH' = currentGate?.tipo ?? 'BOTH';

  const handleBarCodeScanned = async (codes: any[]) => {
    const data = codes[0]?.value;
    console.log('[SCAN] código detectado:', data?.slice(0, 30), '| scanned:', scanned, '| spaceId:', space?.id);
    if (!data || scanned) return;
    setScanned(true);
    Vibration.vibrate(100);

    try {
      if (!space?.id) {
        throw new Error('No hay space seleccionado');
      }

      const result = await accesosApi.verificar({
        qrCode: data,
        spaceId: space.id,
        tipo: currentGateTipo === 'OUT' ? 'salida' : 'entrada',
      });

      console.log('[SCAN] API result:', result);
      setResultado(result);
      setEstado(result.autorizado ? 'autorizado' : 'rechazado');

      // Abrir barrera si está autorizado y configurada
      if (result.autorizado && barrierConfig?.habilitado) {
        abrirBarrera(barrierConfig).then((barrierResult) => {
          if (!barrierResult.success) {
            console.warn('Barrera:', barrierResult.message);
          }
        });
      }

      // Auto-reset después de 5 segundos
      timeoutRef.current = setTimeout(resetScanner, 5000);
    } catch (error) {
      console.error('Error validando QR:', error);
      setEstado('rechazado');
      setResultado({
        tipo: 'error',
        estado: 'rechazado',
        nombre: null,
        dni: null,
        vecino_nombre: null,
        numeroCasa: null,
        invitacion_id: null,
        personal_id: null,
        mensaje: 'Error de conexión',
      });
      timeoutRef.current = setTimeout(resetScanner, 3000);
    }
  };

  const buscarManual = async () => {
    if (!space?.id || !busqueda.trim()) {
      setResultadosBusqueda([]);
      return;
    }
    try {
      const { resultados } = await invitacionesApi.buscar(space.id, busqueda.trim());
      setResultadosBusqueda(resultados);
    } catch (error) {
      console.error('Error buscando:', error);
      Alert.alert('Error', 'No se pudo realizar la búsqueda');
      setResultadosBusqueda([]);
    }
  };

  const seleccionarInvitacion = async (inv: any) => {
    setShowManual(false);
    setBusqueda('');
    setResultadosBusqueda([]);
    if (inv.qrCode) {
      await handleBarCodeScanned({ data: inv.qrCode } as any);
    }
  };

  const getBackgroundColor = () => {
    switch (estado) {
      case 'autorizado': return '#22c55e';
      case 'rechazado': return '#ef4444';
      case 'pendiente': return '#eab308';
      default: return '#1a1a2e';
    }
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Cargando cámara...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Necesitamos acceso a la cámara para escanear QRs
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      {estado === 'idle' ? (
        <>
          <View style={styles.cameraContainer}>
            <Camera
              ref={cameraRef}
              style={styles.camera}
              device={device}
              isActive={estado === 'idle'}
              frameProcessor={cameraMode === 'face' ? frameProcessor : undefined}
              codeScanner={cameraMode === 'qr' && !scanned ? {
                codeTypes: ['qr'],
                onCodeScanned: handleBarCodeScanned,
              } : undefined}
            />
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
              {faceDetectionActive && (
                <View style={styles.autoDetectIndicator}>
                  <Text style={styles.autoDetectText}>🔍 Buscando rostros...</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeBtn, cameraMode === 'qr' && styles.modeBtnActive]}
              onPress={() => setCameraMode('qr')}
            >
              <Text style={styles.modeBtnText}>📷 QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, cameraMode === 'face' && styles.modeBtnActive]}
              onPress={() => setCameraMode('face')}
            >
              <Text style={styles.modeBtnText}>👤 Rostro</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.instruction}>
            {cameraMode === 'qr' ? 'Apuntá al código QR para validar el acceso' : 'Enfocá el rostro para identificar al vecino'}
          </Text>
          
          {faceDetectionActive && (
            <Text style={styles.loadingText}>🎯 Rostro detectado - Procesando...</Text>
          )}
          
          {gates.length > 0 && (
            <TouchableOpacity style={styles.gateSelector} onPress={() => setShowGatePicker(true)}>
              <Text style={styles.gateSelectorIcon}>
                {currentGateTipo === 'IN' ? '🟢' : currentGateTipo === 'OUT' ? '🔴' : '🔵'}
              </Text>
              <Text style={styles.gateSelectorText}>
                {currentGate ? currentGate.nombre : 'Todos los accesos (BOTH)'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManual(true)}
          >
            <Text style={styles.manualButtonText}>🔍 Buscar por DNI / Nombre / Patente</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.resultContainer} onPress={resetScanner} activeOpacity={0.9}>
          <Text style={styles.statusIcon}>
            {estado === 'autorizado' ? '✓' : estado === 'pendiente' ? '⏳' : '✕'}
          </Text>
          
          <Text style={styles.statusText}>
            {estado === 'autorizado' && '¡AUTORIZADO!'}
            {estado === 'rechazado' && 'NO AUTORIZADO'}
            {estado === 'pendiente' && 'FUERA DE HORARIO'}
          </Text>

          {resultado?.numeroCasa && (
            <Text style={styles.casaText}>Casa {resultado.numeroCasa}</Text>
          )}
          
          {resultado?.nombre && (
            <Text style={styles.nombreText}>{resultado.nombre}</Text>
          )}

          {resultado?.vecino_nombre && (
            <Text style={styles.vecinoText}>
              Visita para: {resultado.vecino_nombre}
            </Text>
          )}

          <Text style={styles.mensajeText}>{resultado?.mensaje}</Text>

          {estado === 'pendiente' && (
            <View style={styles.pendienteActions}>
              <TouchableOpacity
                style={styles.autorizarButton}
                onPress={() => resolverPendiente('autorizado')}
              >
                <Text style={styles.autorizarButtonText}>✓ Autorizar ingreso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rechazarButton}
                onPress={() => resolverPendiente('rechazado')}
              >
                <Text style={styles.rechazarButtonText}>✕ Rechazar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.tapText}>Toca para escanear otro</Text>
        </TouchableOpacity>
      )}

      {/* Modal de registro de salida */}
      <Modal visible={showCorregirSalidaModal} animationType="fade" transparent onRequestClose={resetScanner}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 48 }}>🕐</Text>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Salida ya registrada</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              {resultado?.nombre ?? 'El visitante'} ya tiene salida registrada a las {salidaPrevio ? new Date(salidaPrevio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}.{'\n'}¿Actualizás la hora de salida a ahora?
            </Text>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: '#3b82f6', width: '100%', marginBottom: 10 }]}
              onPress={corregirSalida}
            >
              <Text style={styles.searchButtonText}>✓ Actualizar hora de salida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: '#334155', width: '100%' }]} onPress={resetScanner}
            >
              <Text style={styles.searchButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSalidaModal} animationType="fade" transparent onRequestClose={resetScanner}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 48 }}>🚪</Text>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Esta persona está adentro</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              {resultado?.nombre ?? 'El visitante'} ya registró entrada hoy.{'\n'}¿Registrás la salida?
            </Text>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: '#e94560', width: '100%', marginBottom: 10 }]}
              onPress={() => registrarSalida()}
            >
              <Text style={styles.searchButtonText}>✓ Registrar Salida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: '#334155', width: '100%' }]}
              onPress={resetScanner}
            >
              <Text style={styles.searchButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ color: '#475569', fontSize: 12, marginTop: 16 }}>
              Se registra la salida automáticamente en {salidaCountdown}s
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal selector de gate */}
      <Modal visible={showGatePicker} transparent animationType="slide" onRequestClose={() => setShowGatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar punto de acceso</Text>
            <TouchableOpacity
              style={[styles.resultItem, !selectedGateId && { borderWidth: 1, borderColor: '#3b82f6' }]}
              onPress={() => { setSelectedGateId(null); setShowGatePicker(false); }}
            >
              <Text style={styles.resultNombre}>🔵 Todos los accesos</Text>
              <Text style={styles.resultDetalle}>Entrada y Salida (BOTH)</Text>
            </TouchableOpacity>
            {gates.map(gate => (
              <TouchableOpacity
                key={gate.id}
                style={[styles.resultItem, selectedGateId === gate.id && { borderWidth: 1, borderColor: '#3b82f6' }]}
                onPress={() => { setSelectedGateId(gate.id); setShowGatePicker(false); }}
              >
                <Text style={styles.resultNombre}>
                  {gate.tipo === 'IN' ? '🟢' : gate.tipo === 'OUT' ? '🔴' : '🔵'} {gate.nombre}
                </Text>
                <Text style={styles.resultDetalle}>
                  {gate.tipo === 'IN' ? 'Solo Entrada' : gate.tipo === 'OUT' ? 'Solo Salida' : 'Entrada y Salida'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowGatePicker(false)}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de búsqueda manual */}
      <Modal
        visible={showManual}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManual(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Búsqueda Manual</Text>
            
            <TextInput
              style={styles.searchInput}
              placeholder="DNI, nombre o patente..."
              placeholderTextColor="#999"
              value={busqueda}
              onChangeText={setBusqueda}
              onSubmitEditing={buscarManual}
              autoFocus
            />

            <TouchableOpacity style={styles.searchButton} onPress={buscarManual}>
              <Text style={styles.searchButtonText}>Buscar</Text>
            </TouchableOpacity>

            {resultadosBusqueda.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.resultItem}
                onPress={() => seleccionarInvitacion(item)}
              >
                <Text style={styles.resultNombre}>{item.nombre_invitado}</Text>
                <Text style={styles.resultDetalle}>
                  Casa {item.numeroCasa} • {item.vecinoNombre}
                </Text>
                {item.dni_invitado && (
                  <Text style={styles.resultDni}>DNI: {item.dni_invitado}</Text>
                )}
                {item.patente && (
                  <Text style={styles.resultDni}>Patente: {item.patente}</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowManual(false);
                setBusqueda('');
                setResultadosBusqueda([]);
              }}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionButton: {
    marginTop: 24,
    backgroundColor: '#e94560',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: width * 0.6,
    height: width * 0.6,
    borderWidth: 3,
    borderColor: '#e94560',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instruction: {
    color: '#fff',
    fontSize: 20,
    marginTop: 32,
    fontWeight: '500',
  },
  modeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  modeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modeBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  modeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  gateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  gateSelectorIcon: { fontSize: 16 },
  gateSelectorText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  manualButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statusIcon: {
    fontSize: 120,
    color: '#fff',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  casaText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
  },
  nombreText: {
    fontSize: 28,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  vecinoText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 16,
  },
  mensajeText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 24,
    textAlign: 'center',
  },
  tapText: {
    position: 'absolute',
    bottom: 50,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  pendienteActions: {
    marginTop: 32,
    width: '100%',
    paddingHorizontal: 32,
    gap: 12,
  },
  autorizarButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  autorizarButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  rechazarButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rechazarButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: height * 0.5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  searchButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resultItem: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  resultNombre: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  resultDetalle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  resultDni: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#e94560',
    fontSize: 16,
  },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    width: '100%',
    maxWidth: 500,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
    textAlign: 'center',
  },
  webInput: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    fontSize: 20,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#0f3460',
    width: '100%',
    textAlign: 'center',
  },
  webSearchButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  webSearchButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  resultadosContainer: {
    width: '100%',
    marginTop: 24,
  },
  resultadoItem: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  resultadoNombre: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  resultadoInfo: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  // Estilos para reconocimiento facial
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
    marginTop: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#e94560',
  },
  modeButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  // Estilos para botones de reconocimiento
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 10,
    gap: 15,
  },
  faceButton: {
    flex: 1,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  faceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  modeButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  faceGuide: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    borderWidth: 3,
    borderColor: '#e94560',
    backgroundColor: 'transparent',
  },
  captureButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e94560',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(233, 69, 96, 0.5)',
  },
  captureButtonText: {
    fontSize: 32,
    color: '#fff',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  autoDetectIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  autoDetectText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 10,
  },
  faceButtonAlt: {
    flex: 1,
    backgroundColor: '#1e40af',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  faceButtonTextAlt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
