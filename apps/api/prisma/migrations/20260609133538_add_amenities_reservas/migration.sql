-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('pendiente', 'confirmada', 'rechazada', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoPagoReserva" AS ENUM ('sin_costo', 'pendiente_mp', 'pendiente_transferencia', 'pagado', 'rechazado');

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "capacidad" INTEGER,
    "hora_apertura" TEXT NOT NULL,
    "hora_cierre" TEXT NOT NULL,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT false,
    "precio_reserva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "turnos_config" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "amenity_id" TEXT NOT NULL,
    "vecino_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'pendiente',
    "monto" DOUBLE PRECISION DEFAULT 0,
    "estado_pago" "EstadoPagoReserva" NOT NULL DEFAULT 'sin_costo',
    "metodo_pago" TEXT,
    "comprobante_url" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_space_id_idx" ON "reservas"("space_id");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_vecino_id_fkey" FOREIGN KEY ("vecino_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
