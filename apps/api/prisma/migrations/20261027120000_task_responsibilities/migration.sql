-- HU-35 · Responsabilidades de la tarea (ADR-0005). Escrita a mano a partir de `prisma migrate diff`:
-- el responsable (un usuario) pasa a "Actividad" (una persona del catálogo del espacio).

ALTER TABLE "tasks" ADD COLUMN "activity_person_id" UUID,
ADD COLUMN "follow_up_person_id" UUID,
ADD COLUMN "management_person_id" UUID;

-- Responsables que no tienen persona en el espacio (p. ej. los quitados antes de HU-34): se les
-- crea, vinculada a su cuenta; si el nombre ya lo usa otra persona, se le agrega el correo.
-- UUID v7 armado en SQL (igual que en project_types).
INSERT INTO "people" ("id", "workspace_id", "name", "user_id", "updated_at")
SELECT
    encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
            52, 1), 53, 1),
        'hex')::uuid,
    m."workspace_id",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "people" p
            WHERE p."workspace_id" = m."workspace_id" AND p."name" = m."name" AND p."archived_at" IS NULL
        ) THEN m."name" || ' (' || m."email" || ')'
        ELSE m."name"
    END,
    m."user_id",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT t."workspace_id", u."id" AS "user_id", u."name", u."email"
    FROM "tasks" t
    JOIN "users" u ON u."id" = t."assignee_id"
    WHERE NOT EXISTS (
        SELECT 1 FROM "people" p WHERE p."workspace_id" = t."workspace_id" AND p."user_id" = t."assignee_id"
    )
) m;

-- Cada responsable pasa a Actividad, con la persona vinculada a su cuenta en ese espacio
UPDATE "tasks" t
SET "activity_person_id" = p."id"
FROM "people" p
WHERE p."workspace_id" = t."workspace_id" AND p."user_id" = t."assignee_id";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_fkey";

-- DropIndex
DROP INDEX "tasks_assignee_id_idx";

ALTER TABLE "tasks" DROP COLUMN "assignee_id";

-- CreateIndex
CREATE INDEX "tasks_activity_person_id_idx" ON "tasks"("activity_person_id");

-- CreateIndex
CREATE INDEX "tasks_management_person_id_idx" ON "tasks"("management_person_id");

-- CreateIndex
CREATE INDEX "tasks_follow_up_person_id_idx" ON "tasks"("follow_up_person_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_activity_person_id_fkey" FOREIGN KEY ("activity_person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_management_person_id_fkey" FOREIGN KEY ("management_person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_follow_up_person_id_fkey" FOREIGN KEY ("follow_up_person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
