-- AlterTable
ALTER TABLE "Project" ADD COLUMN "showDayFlagsDirectorVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectShowFlag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShowFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectShowFlag_projectId_idx" ON "ProjectShowFlag"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectShowFlag" ADD CONSTRAINT "ProjectShowFlag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
