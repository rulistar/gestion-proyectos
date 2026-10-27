-- Corrección del PO a HU-35 (2026-10-27): Actividad, Gestión y Seguimiento son TIPOS de tarea, y
-- la tarea tiene un solo Responsable (una persona del catálogo). Escrita a mano.

-- 1. "Actividad" pasa a ser el Responsable (se renombra: sus datos se conservan)
ALTER TABLE "tasks" RENAME COLUMN "activity_person_id" TO "responsible_person_id";
ALTER INDEX "tasks_activity_person_id_idx" RENAME TO "tasks_responsible_person_id_idx";
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_activity_person_id_fkey" TO "tasks_responsible_person_id_fkey";

-- 2. Gestión y Seguimiento dejan de ser responsables: se quitan sus columnas
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_management_person_id_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_follow_up_person_id_fkey";
DROP INDEX "tasks_management_person_id_idx";
DROP INDEX "tasks_follow_up_person_id_idx";
ALTER TABLE "tasks" DROP COLUMN "management_person_id",
DROP COLUMN "follow_up_person_id";

-- 3. Tipos de tarea nuevos en cada espacio, justo después de Fast track (posiciones 3, 4 y 5): los
-- que estaban de la 3 en adelante se recorren. Si un espacio ya tiene uno con ese nombre, no se repite.
UPDATE "task_types" SET "position" = "position" + 3 WHERE "position" >= 3;

INSERT INTO "task_types" ("id", "workspace_id", "name", "expedited", "position", "updated_at")
SELECT
    encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
            52, 1), 53, 1),
        'hex')::uuid,
    w."id", t."name", false, t."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES ('Actividad', 3), ('Gestión', 4), ('Seguimiento', 5)) AS t("name", "position")
WHERE NOT EXISTS (
    SELECT 1 FROM "task_types" tt
    WHERE tt."workspace_id" = w."id" AND lower(tt."name") = lower(t."name") AND tt."archived_at" IS NULL
);
