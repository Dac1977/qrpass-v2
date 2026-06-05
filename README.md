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

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Correr API y web en paralelo
pnpm dev
```

## Deploy en VPS

```bash
cp .env.example .env
# Editar .env con los valores reales
docker compose up -d
```
