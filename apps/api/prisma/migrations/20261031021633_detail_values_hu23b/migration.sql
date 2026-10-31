-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}';
