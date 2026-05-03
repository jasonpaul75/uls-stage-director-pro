-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INTAKE_DRAFT', 'INTAKE_SUBMITTED');

ALTER TABLE "Project" ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'INTAKE_DRAFT';
ALTER TABLE "Project" ADD COLUMN "venue" TEXT;
ALTER TABLE "Project" ADD COLUMN "cityState" TEXT;
ALTER TABLE "Project" ADD COLUMN "requestedEventStart" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "requestedEventEnd" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "categoryNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "contestantApprox" INTEGER;
ALTER TABLE "Project" ADD COLUMN "livestreamNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "budgetNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "additionalNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "submittedAt" TIMESTAMP(3);

CREATE INDEX "Project_status_idx" ON "Project"("status");
