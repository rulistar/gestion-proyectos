-- HU-49: contenedores de trabajo o personales. Los que ya existen quedan como trabajo.

-- CreateEnum
CREATE TYPE "project_scope" AS ENUM ('WORK', 'PERSONAL');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "scope" "project_scope" NOT NULL DEFAULT 'WORK';
