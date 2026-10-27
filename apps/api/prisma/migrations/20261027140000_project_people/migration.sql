-- HU-36 · Personas del proyecto desde el catálogo (ADR-0005 §3). Escrita a mano: los cinco campos
-- de texto de HU-31 pasan a referencias a "people", sin perder lo capturado.

ALTER TABLE "projects" ADD COLUMN "requester_id" UUID,
ADD COLUMN "assigned_to_id" UUID,
ADD COLUMN "project_manager_id" UUID,
ADD COLUMN "consulting_manager_id" UUID,
ADD COLUMN "business_partner_id" UUID;

-- Cada nombre distinto (sin espacios sobrantes ni mayúsculas) que no exista ya como persona activa
-- del espacio se da de alta en el catálogo. UUID v7 armado en SQL (igual que en project_types).
INSERT INTO "people" ("id", "workspace_id", "name", "updated_at")
SELECT
    encode(
        set_bit(set_bit(
            overlay(uuid_send(gen_random_uuid())
                placing substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
            52, 1), 53, 1),
        'hex')::uuid,
    n."workspace_id", n."name", CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (v."workspace_id", lower(v."name")) v."workspace_id", v."name"
    FROM (
        SELECT p."workspace_id", trim(x."value") AS "name"
        FROM "projects" p
        CROSS JOIN LATERAL (VALUES
            (p."requester"), (p."assigned_to"), (p."project_manager"),
            (p."consulting_manager"), (p."business_partner")
        ) AS x("value")
        WHERE x."value" IS NOT NULL AND trim(x."value") <> ''
    ) v
    WHERE NOT EXISTS (
        SELECT 1 FROM "people" pe
        WHERE pe."workspace_id" = v."workspace_id" AND lower(pe."name") = lower(v."name")
          AND pe."archived_at" IS NULL
    )
    ORDER BY v."workspace_id", lower(v."name"), v."name"
) n;

-- Cada texto apunta a la persona activa del espacio con ese nombre (sin distinguir mayúsculas)
UPDATE "projects" p SET
    "requester_id" = (SELECT pe."id" FROM "people" pe WHERE pe."workspace_id" = p."workspace_id" AND pe."archived_at" IS NULL AND lower(pe."name") = lower(trim(p."requester")) LIMIT 1),
    "assigned_to_id" = (SELECT pe."id" FROM "people" pe WHERE pe."workspace_id" = p."workspace_id" AND pe."archived_at" IS NULL AND lower(pe."name") = lower(trim(p."assigned_to")) LIMIT 1),
    "project_manager_id" = (SELECT pe."id" FROM "people" pe WHERE pe."workspace_id" = p."workspace_id" AND pe."archived_at" IS NULL AND lower(pe."name") = lower(trim(p."project_manager")) LIMIT 1),
    "consulting_manager_id" = (SELECT pe."id" FROM "people" pe WHERE pe."workspace_id" = p."workspace_id" AND pe."archived_at" IS NULL AND lower(pe."name") = lower(trim(p."consulting_manager")) LIMIT 1),
    "business_partner_id" = (SELECT pe."id" FROM "people" pe WHERE pe."workspace_id" = p."workspace_id" AND pe."archived_at" IS NULL AND lower(pe."name") = lower(trim(p."business_partner")) LIMIT 1);

ALTER TABLE "projects" DROP COLUMN "requester",
DROP COLUMN "assigned_to",
DROP COLUMN "project_manager",
DROP COLUMN "consulting_manager",
DROP COLUMN "business_partner";

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_consulting_manager_id_fkey" FOREIGN KEY ("consulting_manager_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
