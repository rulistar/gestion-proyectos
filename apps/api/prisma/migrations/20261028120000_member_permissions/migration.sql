-- Permisos por persona (ADR-0006): matriz por membresía y lista "Estos…".
-- Cada membresía actual recibe la matriz que reproduce lo que hoy puede hacer (ADR-0006 §5).

-- AlterTable: la columna se crea con un valor temporal y se llena por rol
ALTER TABLE "memberships" ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '{}';

UPDATE "memberships" SET "permissions" = '{
  "sections": {
    "WITH_END": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "EDITABLE"},
    "ONGOING": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "EDITABLE"},
    "ON_DEMAND": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "EDITABLE"}
  },
  "tasks": {"view": "VISIBLE", "create": true, "update": "VISIBLE", "remove": "EDITABLE"}
}'::jsonb WHERE "role" = 'ADMIN';

-- Miembro: hoy ve todo, crea y modifica proyectos (sin darlos de baja) y gestiona todas las tareas
UPDATE "memberships" SET "permissions" = '{
  "sections": {
    "WITH_END": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "NONE"},
    "ONGOING": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "NONE"},
    "ON_DEMAND": {"view": "ALL", "create": true, "update": "VISIBLE", "remove": "NONE"}
  },
  "tasks": {"view": "VISIBLE", "create": true, "update": "VISIBLE", "remove": "EDITABLE"}
}'::jsonb WHERE "role" = 'MEMBER';

-- Lector: hoy solo ve
UPDATE "memberships" SET "permissions" = '{
  "sections": {
    "WITH_END": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ONGOING": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"},
    "ON_DEMAND": {"view": "ALL", "create": false, "update": "NONE", "remove": "NONE"}
  },
  "tasks": {"view": "VISIBLE", "create": false, "update": "NONE", "remove": "NONE"}
}'::jsonb WHERE "role" = 'VIEWER';

-- Las membresías nuevas siempre traen su matriz
ALTER TABLE "memberships" ALTER COLUMN "permissions" DROP DEFAULT;

-- AlterTable: la visibilidad por proyecto (HU-16) se sustituye por la de cada persona
ALTER TABLE "projects" DROP COLUMN "visibility";

-- DropEnum
DROP TYPE "project_visibility";

-- CreateTable
CREATE TABLE "membership_project_access" (
    "membership_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "membership_project_access_pkey" PRIMARY KEY ("membership_id","project_id")
);

-- CreateIndex
CREATE INDEX "membership_project_access_project_id_idx" ON "membership_project_access"("project_id");

-- AddForeignKey
ALTER TABLE "membership_project_access" ADD CONSTRAINT "membership_project_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_project_access" ADD CONSTRAINT "membership_project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_project_access" ADD CONSTRAINT "membership_project_access_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
