-- AlterTable
ALTER TABLE "Project" ADD COLUMN "proposalPricingNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "proposalTechRiderNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "proposalCrewNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "proposalDirectorVisible" BOOLEAN NOT NULL DEFAULT false;
