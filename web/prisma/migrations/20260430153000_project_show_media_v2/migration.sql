-- CreateEnum
CREATE TYPE "ShowMediaLane" AS ENUM ('MUSIC', 'VIDEO');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "showMediaDirectorVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectShowMediaItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lane" "ShowMediaLane" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fileName" VARCHAR(420) NOT NULL,
    "contentType" VARCHAR(200) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(520) NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShowMediaItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectShowMediaItem_storageKey_key" ON "ProjectShowMediaItem"("storageKey");

CREATE INDEX "ProjectShowMediaItem_projectId_idx" ON "ProjectShowMediaItem"("projectId");

CREATE INDEX "ProjectShowMediaItem_projectId_lane_sortOrder_idx" ON "ProjectShowMediaItem"("projectId", "lane", "sortOrder");

ALTER TABLE "ProjectShowMediaItem" ADD CONSTRAINT "ProjectShowMediaItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectShowMediaItem" ADD CONSTRAINT "ProjectShowMediaItem_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
