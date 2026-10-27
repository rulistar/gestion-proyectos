-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "people_workspace_id_idx" ON "people"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_workspace_id_name_key" ON "people"("workspace_id", "name") WHERE ("archived_at" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "people_workspace_id_user_id_key" ON "people"("workspace_id", "user_id");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HU-34: cada miembro actual recibe su persona vinculada, con su nombre de cuenta. Si dos miembros
-- del mismo espacio se llaman igual, al segundo se le agrega su correo para no chocar con el
-- índice único de nombres. UUID v7 armado en SQL (igual que en project_types).
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
    CASE WHEN m."rank" = 1 THEN m."name" ELSE m."name" || ' (' || m."email" || ')' END,
    m."user_id",
    CURRENT_TIMESTAMP
FROM (
    SELECT ms."workspace_id", ms."user_id", u."name", u."email",
           row_number() OVER (PARTITION BY ms."workspace_id", u."name" ORDER BY ms."created_at") AS "rank"
    FROM "memberships" ms
    JOIN "users" u ON u."id" = ms."user_id"
    WHERE ms."deleted_at" IS NULL
) m;
