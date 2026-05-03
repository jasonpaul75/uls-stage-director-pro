ALTER TABLE "Project" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "assignedToUserId" TEXT;

CREATE INDEX "Project_assignedToUserId_idx" ON "Project"("assignedToUserId");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
