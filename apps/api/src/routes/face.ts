import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const face = new Hono();
face.use('*', authMiddleware);

const registerSchema = z.object({
  photos: z.array(z.string()).min(3).max(3),
});

const verifySchema = z.object({
  photo: z.string(),
  spaceId: z.string().optional(),
});

// POST /face/register - registrar rostro del usuario
face.post('/register', zValidator('json', registerSchema), async (c) => {
  const { userId } = c.get('user');
  const { photos } = c.req.valid('json');

  // Validar que las fotos sean base64 válidos
  const validPhotos = photos.filter(p => p && p.length > 100);
  if (validPhotos.length < 3) {
    return c.json({ error: 'Se requieren 3 fotos válidas' }, 400);
  }

  // Guardar las fotos como JSON en faceData
  const faceData = JSON.stringify({
    photos: validPhotos,
    registeredAt: new Date().toISOString(),
  });

  await prisma.user.update({
    where: { id: userId },
    data: { faceData },
  });

  return c.json({ success: true, message: 'Rostro registrado correctamente' });
});

// POST /face/verify - verificar rostro
face.post('/verify', zValidator('json', verifySchema), async (c) => {
  const { photo, spaceId } = c.req.valid('json');

  if (!photo || photo.length < 100) {
    return c.json({ error: 'Foto inválida' }, 400);
  }

  // Buscar usuarios con faceData en el space (si se proporciona spaceId)
  const where: any = {
    faceData: { not: null },
    activo: true,
  };

  if (spaceId) {
    where.barrioId = spaceId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      nombre: true,
      faceData: true,
      rol: true,
      numeroCasa: true,
    },
  });

  // Comparación simple de similitud (en producción usar face-api.js o similar)
  let bestMatch: any = null;
  let bestScore = 0;

  for (const user of users) {
    if (!user.faceData) continue;

    try {
      const faceData = JSON.parse(user.faceData);
      if (!faceData.photos || faceData.photos.length === 0) continue;

      // Simulación de comparación - en producción usar embeddings reales
      // Aquí hacemos una comparación básica de tamaño de string como placeholder
      const score = calculateSimilarity(photo, faceData.photos[0]);

      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = user;
      }
    } catch (e) {
      console.error('Error parsing faceData:', e);
    }
  }

  if (bestMatch) {
    return c.json({
      match: true,
      user: {
        id: bestMatch.id,
        email: bestMatch.email,
        nombre: bestMatch.nombre,
        rol: bestMatch.rol,
        numeroCasa: bestMatch.numeroCasa,
      },
      confidence: bestScore,
    });
  }

  return c.json({
    match: false,
    user: null,
    confidence: 0,
  });
});

// Función placeholder para calcular similitud
// En producción usar face-api.js o @vladmandic/face-api para embeddings reales
function calculateSimilarity(photo1: string, photo2: string): number {
  // Placeholder: comparación básica de longitud de strings
  // Esto NO es reconocimiento facial real, solo para desarrollo
  const len1 = photo1.length;
  const len2 = photo2.length;
  const diff = Math.abs(len1 - len2);
  const maxLen = Math.max(len1, len2);
  return 1 - (diff / maxLen);
}

export default face;
