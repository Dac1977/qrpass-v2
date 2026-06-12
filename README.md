# QRPass v2

Monorepo — Hono JS + Next.js + React Native + Postgres + Prisma

## Stack

| Capa | Tecnología |
|---|---|
| Backend API | Hono JS |
| Base de datos | PostgreSQL + Prisma |
| Frontend web | Next.js |
| App mobile | React Native (Expo) |
| Deploy | Docker + Nginx en VPS |

## Estructura

```
apps/
  api/      → Backend (Hono + Prisma)
  web/      → Frontend (Next.js)
  mobile/   → App (Expo)
packages/
  types/    → Tipos TypeScript compartidos
```

## Desarrollo local

**1. Instalar dependencias:**
```bash
pnpm install
```

**2. Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus valores (DB_PASSWORD, JWT_SECRET, API_URL)
```

**3. Configurar base de datos (elije una opción):**

**Opción A - Docker:**
```bash
docker run -d --name qrpass-db \
  -e POSTGRES_USER=qrpass \
  -e POSTGRES_PASSWORD=qrpass123 \
  -e POSTGRES_DB=qrpass \
  -p 5432:5432 \
  postgres:15
```

**Opción B - PostgreSQL local:**
```bash
# Crear base de datos manualmente
createdb qrpass
# Asegurarse de que el usuario/contraseña coincidan con .env
```

**4. Ejecutar migraciones de Prisma:**
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
cd ../..
```

**5. Iniciar servicios:**
```bash
# API y web en paralelo
pnpm dev

# O individualmente:
pnpm dev:api    # API en http://localhost:3000
pnpm dev:web    # Web en http://localhost:3001
```

**6. App móvil (Expo):**
```bash
cd apps/mobile
# Instalar Expo Go en tu dispositivo
npx expo start
# Escanear QR desde Expo Go
```

## Deploy en VPS

```bash
cp .env.example .env
# Editar .env con los valores reales
docker compose up -d
```
