-- CreateEnum
CREATE TYPE "ProjectAttachmentKind" AS ENUM ('CONTRACT', 'INSURANCE_COMPLIANCE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "retentionLegalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "retentionLegalHoldNote" VARCHAR(2000);

-- CreateTable
CREATE TABLE "ProjectAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectAttachmentKind" NOT NULL,
    "fileName" VARCHAR(420) NOT NULL,
    "contentType" VARCHAR(200) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(520) NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAttachment_storageKey_key" ON "ProjectAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
