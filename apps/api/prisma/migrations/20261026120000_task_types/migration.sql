-- HU-22 · Tipos de tarea (ADR-0004). Escrita a mano a partir de `prisma migrate diff`:
-- crea el catálogo en cada espacio, pasa las tareas del antiguo enum "task_type" a su tipo del
-- catálogo y carga los tipos permitidos de los mantenimientos iniciales.

-- CreateTable
CREATE TABLE "task_types" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "expedited" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_type_task_types" (
    "project_type_id" UUID NOT NULL,
    "task_type_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "project_type_task_types_pkey" PRIMARY KEY ("project_type_id","task_type_id")
);

-- CreateIndex
CREATE INDEX "task_types_workspace_id_idx" ON "task_types"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_workspace_id_name_key" ON "task_types"("workspace_id", "name") WHERE ("archived_at" IS NULL);

-- CreateIndex
CREATE INDEX "project_type_task_types_task_type_id_idx" ON "project_type_task_types"("task_type_id");

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_type_task_types" ADD CONSTRAINT "project_type_task_types_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_type_task_types" ADD CONSTRAINT "project_type_task_types_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_type_task_types" ADD CONSTRAINT "project_type_task_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tipos iniciales en cada espacio (ADR-0004 §5), con UUID v7 armado en SQL (PostgreSQL 17 no
-- trae uuidv7(); igual que en la migración project_types)
INSERT INTO "task_types" ("id", "workspace_id", "name", "expedited", "position", "updated_at")
SELECT
    encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
            52, 1), 53, 1),
        'hex')::uuid,
    w."id", t."name", t."expedited", t."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
    ('Tarea', false, 0),
    ('Incidencia', false, 1),
    ('Fast track', true, 2),
    ('Reunión', false, 3),
    ('Entregable', false, 4),
    ('Revisión', false, 5),
    ('Investigación', false, 6),
    ('Examen', false, 7)
) AS t("name", "expedited", "position");

-- Las tareas pasan del enum al catálogo (cada valor viejo tiene su tipo con el mismo sentido)
ALTER TABLE "tasks" ADD COLUMN "started_at" TIMESTAMPTZ(3),
ADD COLUMN "type_id" UUID;

UPDATE "tasks" t
SET "type_id" = tt."id"
FROM "task_types" tt
JOIN (VALUES
    ('TASK', 'Tarea'),
    ('MEETING', 'Reunión'),
    ('DELIVERABLE', 'Entregable'),
    ('REVIEW', 'Revisión'),
    ('RESEARCH', 'Investigación'),
    ('EXAM', 'Examen')
) AS legacy("value", "name") ON legacy."name" = tt."name"
WHERE tt."workspace_id" = t."workspace_id" AND legacy."value" = t."type"::text;

ALTER TABLE "tasks" ALTER COLUMN "type_id" SET NOT NULL;
ALTER TABLE "tasks" DROP COLUMN "type";

-- DropEnum
DROP TYPE "task_type";

-- CreateIndex
CREATE INDEX "tasks_type_id_idx" ON "tasks"("type_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "task_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tipos permitidos de los mantenimientos iniciales (los demás tipos admiten todos)
INSERT INTO "project_type_task_types" ("project_type_id", "task_type_id")
SELECT pt."id", tt."id"
FROM "project_types" pt
JOIN (VALUES
    ('Mtto correctivo', 'Incidencia'),
    ('Mtto correctivo', 'Fast track'),
    ('Mtto correctivo', 'Tarea'),
    ('Mtto evolutivo', 'Tarea'),
    ('Mtto evolutivo', 'Fast track'),
    ('Mtto evolutivo', 'Entregable'),
    ('Mtto evolutivo', 'Revisión')
) AS allowed("project_type", "task_type") ON allowed."project_type" = pt."name"
JOIN "task_types" tt ON tt."workspace_id" = pt."workspace_id" AND tt."name" = allowed."task_type"
WHERE pt."archived_at" IS NULL;
