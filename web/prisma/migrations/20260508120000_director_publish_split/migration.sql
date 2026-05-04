-- Split director-facing visibility so producers can expose proposal notes, mirrored contracts, and Stripe billing independently.

ALTER TABLE "Project" ADD COLUMN "contractsDirectorVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "stripeBillingDirectorVisible" BOOLEAN NOT NULL DEFAULT false;

-- Preserve behavior for existing rows: wherever proposal was visible, expose contracts + billing too.

UPDATE "Project"
SET
  "contractsDirectorVisible" = "proposalDirectorVisible",
  "stripeBillingDirectorVisible" = "proposalDirectorVisible";
