-- CreateTable
CREATE TABLE "project_task_types" (
    "project_id" UUID NOT NULL,
    "task_type_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "project_task_types_pkey" PRIMARY KEY ("project_id","task_type_id")
);

-- CreateIndex
CREATE INDEX "project_task_types_task_type_id_idx" ON "project_task_types"("task_type_id");

-- AddForeignKey
ALTER TABLE "project_task_types" ADD CONSTRAINT "project_task_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_types" ADD CONSTRAINT "project_task_types_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_types" ADD CONSTRAINT "project_task_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
