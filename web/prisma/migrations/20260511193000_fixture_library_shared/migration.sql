-- Tenant-wide fixture library presets + lightweight audit trail for hosted merges/replaces.

CREATE TABLE "FixtureLibrarySharedPreset" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" VARCHAR(48) NOT NULL,
    "labelKey" VARCHAR(48) NOT NULL,
    "equipment" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixtureLibrarySharedPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FixtureLibrarySharedPreset_labelKey_key" ON "FixtureLibrarySharedPreset"("labelKey");

CREATE INDEX "FixtureLibrarySharedPreset_sortOrder_idx" ON "FixtureLibrarySharedPreset"("sortOrder");

CREATE TABLE "FixtureLibrarySharedAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureLibrarySharedAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FixtureLibrarySharedAuditLog_createdAt_idx" ON "FixtureLibrarySharedAuditLog"("createdAt");

ALTER TABLE "FixtureLibrarySharedPreset" ADD CONSTRAINT "FixtureLibrarySharedPreset_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FixtureLibrarySharedAuditLog" ADD CONSTRAINT "FixtureLibrarySharedAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
