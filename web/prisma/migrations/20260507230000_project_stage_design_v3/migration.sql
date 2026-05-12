-- CreateEnum
CREATE TYPE "StageDesignUnit" AS ENUM ('FEET', 'METERS');

-- CreateTable
CREATE TABLE "ProjectStageDesign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL DEFAULT 'Stage diagram',
    "unit" "StageDesignUnit" NOT NULL DEFAULT 'FEET',
    "canvasJson" JSONB NOT NULL DEFAULT '{}',
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStageDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStageDesign_projectId_key" ON "ProjectStageDesign"("projectId");

CREATE INDEX "ProjectStageDesign_projectId_idx" ON "ProjectStageDesign"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectStageDesign" ADD CONSTRAINT "ProjectStageDesign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStageDesign" ADD CONSTRAINT "ProjectStageDesign_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
