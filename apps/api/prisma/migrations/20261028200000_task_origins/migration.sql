-- HU-47: origen de la tarea (catálogo por espacio) y su detalle. Los espacios existentes empiezan
-- sin orígenes: el Admin los da de alta en Configuración; los nuevos traen los iniciales.

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "origin_detail" TEXT,
ADD COLUMN     "origin_id" UUID;

-- CreateTable
CREATE TABLE "task_origins" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "task_origins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_origins_workspace_id_idx" ON "task_origins"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_origins_workspace_id_name_key" ON "task_origins"("workspace_id", "name") WHERE ("archived_at" IS NULL);

-- CreateIndex
CREATE INDEX "tasks_origin_id_idx" ON "tasks"("origin_id");

-- AddForeignKey
ALTER TABLE "task_origins" ADD CONSTRAINT "task_origins_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_origins" ADD CONSTRAINT "task_origins_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_origins" ADD CONSTRAINT "task_origins_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "task_origins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

