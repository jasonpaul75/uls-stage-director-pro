-- AlterTable
ALTER TABLE "Project" ADD COLUMN "runOfShowBody" TEXT,
ADD COLUMN "runOfShowDirectorVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "runOfShowFrozen" BOOLEAN NOT NULL DEFAULT false;
