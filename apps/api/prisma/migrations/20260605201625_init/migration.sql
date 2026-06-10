-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('vecino', 'guardia', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'basic', 'pro');

-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('residential', 'gym', 'club', 'coworking', 'event');

-- CreateEnum
CREATE TYPE "TipoIngreso" AS ENUM ('entrada', 'salida');

-- CreateEnum
CREATE TYPE "MetodoIngreso" AS ENUM ('qr', 'manual', 'facial');

-- CreateEnum
CREATE TYPE "EstadoExpensa" AS ENUM ('pendiente', 'pagada', 'vencida');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "numero_casa" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'vecino',
    "barrio_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estado_aprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'pendiente',
    "expo_push_token" TEXT,
    "qr_code" TEXT,
    "es_titular" BOOLEAN NOT NULL DEFAULT true,
    "titular_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "space_type" "SpaceType" NOT NULL DEFAULT 'residential',
    "precio_por_casa" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "codigo_invitacion" TEXT,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'vecino',
    "numero_unidad" TEXT,
    "estado_aprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'pendiente',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_aprobacion" TIMESTAMP(3),
    "aprobado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingresos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "tipo" "TipoIngreso" NOT NULL DEFAULT 'entrada',
    "metodo" "MetodoIngreso" NOT NULL DEFAULT 'qr',
    "autorizado" BOOLEAN NOT NULL,
    "motivo_rechazo" TEXT,
    "registrado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_emergencia" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "vecino_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT,
    "numero_casa" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "atendida" BOOLEAN NOT NULL DEFAULT false,
    "atendida_por" TEXT,
    "atendida_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expensas" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoExpensa" NOT NULL DEFAULT 'pendiente',
    "fecha_venc" TIMESTAMP(3),
    "fecha_pago" TIMESTAMP(3),
    "comprobante" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expensas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "spaces_codigo_invitacion_key" ON "spaces"("codigo_invitacion");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_space_id_key" ON "memberships"("user_id", "space_id");

-- CreateIndex
CREATE UNIQUE INDEX "expensas_user_id_space_id_mes_anio_key" ON "expensas"("user_id", "space_id", "mes", "anio");

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
