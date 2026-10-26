-- CreateTable
CREATE TABLE "folio_counters" (
    "workspace_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "folio_counters_pkey" PRIMARY KEY ("workspace_id","prefix","period")
);

-- AddForeignKey
ALTER TABLE "folio_counters" ADD CONSTRAINT "folio_counters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
