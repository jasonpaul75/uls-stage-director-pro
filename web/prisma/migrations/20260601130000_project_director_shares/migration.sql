-- CreateTable
CREATE TABLE "ProjectDirectorShare" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" VARCHAR(420) NOT NULL,
    "contentType" VARCHAR(200) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(520) NOT NULL,
    "note" VARCHAR(500),
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDirectorShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDirectorShare_storageKey_key" ON "ProjectDirectorShare"("storageKey");

-- CreateIndex
CREATE INDEX "ProjectDirectorShare_projectId_idx" ON "ProjectDirectorShare"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDirectorShare_uploadedByUserId_idx" ON "ProjectDirectorShare"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "ProjectDirectorShare" ADD CONSTRAINT "ProjectDirectorShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDirectorShare" ADD CONSTRAINT "ProjectDirectorShare_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
