-- v3 — portal publish toggle for producer-authored stage diagram (Show workspace read-only)
ALTER TABLE "Project" ADD COLUMN "stageDesignDirectorVisible" BOOLEAN NOT NULL DEFAULT false;
