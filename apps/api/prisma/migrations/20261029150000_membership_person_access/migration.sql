-- HU-52: personas cuyo trabajo puede ver cada miembro (solo lectura). Empieza vacía.

-- CreateTable
CREATE TABLE "membership_person_access" (
    "membership_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "membership_person_access_pkey" PRIMARY KEY ("membership_id","person_id")
);

-- CreateIndex
CREATE INDEX "membership_person_access_person_id_idx" ON "membership_person_access"("person_id");

-- AddForeignKey
ALTER TABLE "membership_person_access" ADD CONSTRAINT "membership_person_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_person_access" ADD CONSTRAINT "membership_person_access_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_person_access" ADD CONSTRAINT "membership_person_access_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

