-- HU-21 · Tipos de contenedor (ADR-0004). Escrita a mano a partir de la que generó Prisma:
-- carga los tipos iniciales en cada espacio existente y asigna "Proyecto" a los proyectos
-- actuales antes de volver obligatoria la columna type_id.

-- CreateEnum
CREATE TYPE "project_behavior" AS ENUM ('WITH_END', 'ONGOING', 'ON_DEMAND');

-- CreateTable
CREATE TABLE "project_types" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "behavior" "project_behavior" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_types_workspace_id_idx" ON "project_types"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_types_workspace_id_name_key" ON "project_types"("workspace_id", "name") WHERE ("archived_at" IS NULL);

-- AddForeignKey
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tipos iniciales en cada espacio (ADR-0004 §5). PostgreSQL 17 no trae uuidv7(): se arma un
-- UUID v7 (marca de tiempo en milisegundos + bits de versión) a partir de uno aleatorio.
INSERT INTO "project_types" ("id", "workspace_id", "name", "behavior", "position", "updated_at")
SELECT
    encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
            52, 1), 53, 1),
        'hex')::uuid,
    w."id", t."name", t."behavior"::"project_behavior", t."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
    ('Proyecto', 'WITH_END', 0),
    ('Mtto correctivo', 'ONGOING', 1),
    ('Mtto evolutivo', 'ONGOING', 2),
    ('Actividades', 'ON_DEMAND', 3)
) AS t("name", "behavior", "position");

-- AlterTable: fechas reales (vacías en lo existente: no se sabe cuándo empezó de verdad) y tipo
ALTER TABLE "projects" ADD COLUMN     "finished_at" TIMESTAMPTZ(3),
ADD COLUMN     "started_at" TIMESTAMPTZ(3),
ADD COLUMN     "type_id" UUID;

-- Los proyectos actuales pasan al tipo "Proyecto" de su espacio
UPDATE "projects" p
SET "type_id" = pt."id"
FROM "project_types" pt
WHERE pt."workspace_id" = p."workspace_id" AND pt."name" = 'Proyecto';

ALTER TABLE "projects" ALTER COLUMN "type_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "projects_type_id_idx" ON "projects"("type_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "project_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
