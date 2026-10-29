-- HU-17c (ADR-0006 §4): una invitación puede incluir varios espacios, cada uno con su plantilla,
-- su matriz y su lista "Estos…". Las invitaciones pendientes de antes se convierten en una
-- invitación con un solo espacio (el suyo), con la matriz de la plantilla de su rol: lo mismo que
-- recibían al aceptar.

-- CreateTable
CREATE TABLE "invitation_grants" (
    "invitation_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "permissions" JSONB NOT NULL,
    "selected_project_ids" UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "invitation_grants_pkey" PRIMARY KEY ("invitation_id","workspace_id")
);

-- CreateIndex
CREATE INDEX "invitation_grants_workspace_id_idx" ON "invitation_grants"("workspace_id");

-- AddForeignKey
ALTER TABLE "invitation_grants" ADD CONSTRAINT "invitation_grants_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_grants" ADD CONSTRAINT "invitation_grants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_grants" ADD CONSTRAINT "invitation_grants_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invitaciones pendientes de antes: un espacio, el suyo, con la plantilla de su rol (PERMISSION_TEMPLATES)
INSERT INTO "invitation_grants" ("invitation_id", "workspace_id", "role", "permissions", "selected_project_ids", "created_at", "created_by_id")
SELECT "id", "workspace_id", "role",
       CASE "role"
         WHEN 'ADMIN' THEN '{"sections":{"WITH_END":{"view":"ALL","create":true,"update":"VISIBLE","remove":"EDITABLE"},"ONGOING":{"view":"ALL","create":true,"update":"VISIBLE","remove":"EDITABLE"},"ON_DEMAND":{"view":"ALL","create":true,"update":"VISIBLE","remove":"EDITABLE"}},"tasks":{"view":"VISIBLE","create":true,"update":"VISIBLE","remove":"EDITABLE"}}'::jsonb
         WHEN 'MEMBER' THEN '{"sections":{"WITH_END":{"view":"OWN","create":false,"update":"OWN","remove":"NONE"},"ONGOING":{"view":"OWN","create":false,"update":"OWN","remove":"NONE"},"ON_DEMAND":{"view":"OWN","create":false,"update":"OWN","remove":"NONE"}},"tasks":{"view":"MINE","create":true,"update":"MINE","remove":"NONE"}}'::jsonb
         ELSE '{"sections":{"WITH_END":{"view":"ALL","create":false,"update":"NONE","remove":"NONE"},"ONGOING":{"view":"ALL","create":false,"update":"NONE","remove":"NONE"},"ON_DEMAND":{"view":"ALL","create":false,"update":"NONE","remove":"NONE"}},"tasks":{"view":"VISIBLE","create":false,"update":"NONE","remove":"NONE"}}'::jsonb
       END,
       '{}', "created_at", "created_by_id"
FROM "invitations"
WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
