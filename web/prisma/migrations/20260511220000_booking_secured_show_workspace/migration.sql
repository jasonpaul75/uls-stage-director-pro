-- AlterTable
ALTER TABLE "Project" ADD COLUMN "bookingSecuredAt" TIMESTAMP(3);

-- Existing submitted intakes: treat as already booked so current shows keep the operational workspace.
UPDATE "Project"
SET "bookingSecuredAt" = COALESCE("submittedAt", "createdAt")
WHERE "bookingSecuredAt" IS NULL
  AND "status" = 'INTAKE_SUBMITTED';
