-- CreateTable
CREATE TABLE "person_shares" (
    "person_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "person_shares_pkey" PRIMARY KEY ("person_id","workspace_id")
);

-- CreateIndex
CREATE INDEX "person_shares_workspace_id_idx" ON "person_shares"("workspace_id");

-- AddForeignKey
ALTER TABLE "person_shares" ADD CONSTRAINT "person_shares_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_shares" ADD CONSTRAINT "person_shares_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_shares" ADD CONSTRAINT "person_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
