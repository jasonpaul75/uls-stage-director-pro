-- AlterTable
ALTER TABLE "Project" ADD COLUMN "postEventSmugMugUrl" VARCHAR(2048),
ADD COLUMN "postEventPageantExpressionsUrl" VARCHAR(2048),
ADD COLUMN "postEventCastrUrl" VARCHAR(2048),
ADD COLUMN "postEventVaultDirectorVisible" BOOLEAN NOT NULL DEFAULT false;
