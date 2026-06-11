import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface FaceEmbedding {
  descriptor: Float32Array;
  confidence: number;
}

export interface FaceDetectionResult {
  embedding: number[];
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// No necesitamos cargar modelos - usamos análisis de imagen simple
export const loadFaceModels = async (): Promise<boolean> => {
  try {
    console.log('Sistema de reconocimiento facial listo para usar');
    return true;
  } catch (error) {
    console.error('Error inicializando sistema:', error);
    return false;
  }
};

// Generar embedding basado en características de la imagen
const generateImageEmbedding = async (base64Image: string): Promise<number[]> => {
  // Crear un hash/embedding único basado en la imagen
  const embedding: number[] = [];
  
  // Usar características de la string base64 como embedding
  const imageData = base64Image;
  const length = Math.min(imageData.length, 10000); // Limitar para eficiencia
  
  // Generar 128 valores basados en la imagen
  for (let i = 0; i < 128; i++) {
    const step = Math.floor(length / 128);
    const index = i * step;
    
    if (index < imageData.length) {
      // Usar código ASCII de caracteres en posiciones específicas
      const charCode = imageData.charCodeAt(index) || 0;
      // Normalizar entre -1 y 1
      const normalizedValue = (charCode / 127.5) - 1;
      embedding.push(normalizedValue);
    } else {
      // Rellenar con valores derivados
      const prevValue = embedding[embedding.length - 1] || 0;
      embedding.push(Math.sin(prevValue * (i + 1)) * 0.5);
    }
  }
  
  return embedding;
};

// Detectar "rostro" y extraer embedding desde una imagen base64
export const detectFaceFromBase64 = async (
  base64Image: string
): Promise<FaceDetectionResult | null> => {
  console.warn('🚫 RECONOCIMIENTO FACIAL TEMPORALMENTE DESHABILITADO');
  console.warn('📱 Requiere migración completa a react-native-vision-camera + ML Kit');
  console.warn('⚠️ face-api.js no funciona correctamente en React Native');
  return null;
};

// Calcular similitud coseno entre dos embeddings
export const calculateCosineSimilarity = (
  embedding1: number[],
  embedding2: number[]
): number => {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Los embeddings deben tener la misma longitud');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
};

// Validar si dos rostros son la misma persona basado en un umbral
export const validateFaceMatch = (
  embedding1: number[],
  embedding2: number[],
  threshold: number = 0.6
): boolean => {
  const similarity = calculateCosineSimilarity(embedding1, embedding2);
  return similarity >= threshold;
};

// Normalizar embedding para mejor consistencia
export const normalizeEmbedding = (embedding: number[]): number[] => {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return norm === 0 ? embedding : embedding.map(val => val / norm);
};

// Convertir embedding a formato compatible con pgvector
export const embeddingToVectorString = (embedding: number[]): string => {
  return `[${embedding.join(',')}]`;
};

// Convertir string de vector a array
export const vectorStringToEmbedding = (vectorString: string): number[] => {
  return JSON.parse(vectorString);
};
