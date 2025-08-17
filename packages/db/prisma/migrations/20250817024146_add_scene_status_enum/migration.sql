/*
  Warnings:

  - The `status` column on the `Scene` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'REVISED', 'FINAL');

-- DropIndex
DROP INDEX "canon_fact_reveal";

-- DropIndex
DROP INDEX "entity_project_name";

-- DropIndex
DROP INDEX "entity_project_type";

-- DropIndex
DROP INDEX "membership_lookup";

-- DropIndex
DROP INDEX "project_member_lookup";

-- DropIndex
DROP INDEX "scene_chapter_order";

-- DropIndex
DROP INDEX "scene_project_index";

-- DropIndex
DROP INDEX "scene_status";

-- AlterTable
ALTER TABLE "Scene" DROP COLUMN "status",
ADD COLUMN     "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT';
