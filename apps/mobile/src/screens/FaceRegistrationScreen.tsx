import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera as ExpoCamera, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

export default function FaceRegistrationScreen({ navigation }: any) {
  const { profile } = useAuthStore();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStep, setCaptureStep] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const cameraRef = useRef<CameraView>(null);

  const captureSteps = [
    { name: 'Frente', instruction: 'Mira directamente a la cámara' },
    { name: 'Izquierda', instruction: 'Gira tu cabeza hacia la izquierda' },
    { name: 'Derecha', instruction: 'Gira tu cabeza hacia la derecha' },
  ];

  useEffect(() => {
    (async () => {
      const { status } = await ExpoCamera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const captureAndProcessFace = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'La cámara no está lista');
      return;
    }

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        throw new Error('No se pudo capturar la imagen');
      }

      const newPhotos = [...capturedPhotos, photo.base64];
      setCapturedPhotos(newPhotos);

      if (captureStep < captureSteps.length - 1) {
        setCaptureStep(captureStep + 1);
        setIsCapturing(false);
      } else {
        await processCapturedFaces(newPhotos);
      }

    } catch (error) {
      console.error('Error capturando imagen:', error);
      Alert.alert('Error', 'No se pudo capturar la imagen');
      setIsCapturing(false);
    }
  };

  const processCapturedFaces = async (_photos: string[]) => {
    Alert.alert('Próximamente', 'El registro facial estará disponible pronto.');
    setIsCapturing(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No hay acceso a la cámara</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Registro Facial</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.stepCounter}>
            Paso {captureStep + 1} de {captureSteps.length}
          </Text>
          <Text style={styles.stepTitle}>
            {captureSteps[captureStep]?.name}
          </Text>
          <Text style={styles.instructions}>
            {captureSteps[captureStep]?.instruction}
          </Text>
        </View>

        {/* Guía visual para el rostro */}
        <View style={styles.centerContainer}>
          <View style={styles.faceGuide}>
            <View style={styles.faceGuideInner} />
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={captureAndProcessFace}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size={32} color="#fff" />
            ) : (
              <Ionicons name="camera" size={32} color="#fff" />
            )}
          </TouchableOpacity>
          
          {captureStep > 0 && (
            <Text style={styles.progressText}>
              {capturedPhotos.length} de {captureSteps.length} fotos capturadas
            </Text>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  stepCounter: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 8,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 4,
    borderColor: '#00d4aa',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuideInner: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 170, 0.3)',
    backgroundColor: 'transparent',
  },
  controls: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00d4aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#666',
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    borderTopColor: 'transparent',
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 180,
    alignSelf: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#00d4aa',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
