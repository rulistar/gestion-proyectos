-- CreateEnum
CREATE TYPE "detail_field_kind" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'OPTIONS', 'BOOLEAN');

-- CreateTable
CREATE TABLE "detail_fields" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "project_type_id" UUID,
    "task_type_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "detail_field_kind" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "detail_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detail_fields_workspace_id_idx" ON "detail_fields"("workspace_id");

-- CreateIndex
CREATE INDEX "detail_fields_project_type_id_idx" ON "detail_fields"("project_type_id");

-- CreateIndex
CREATE INDEX "detail_fields_task_type_id_idx" ON "detail_fields"("task_type_id");

-- AddForeignKey
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un campo es de un tipo de contenedor o de un tipo de tarea, nunca de los dos (HU-23)
ALTER TABLE "detail_fields" ADD CONSTRAINT "detail_fields_one_owner" CHECK (("project_type_id" IS NULL) <> ("task_type_id" IS NULL));
