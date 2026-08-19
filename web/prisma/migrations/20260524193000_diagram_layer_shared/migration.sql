-- Tenant-wide diagram layer preset stacks + lightweight audit trail for hosted merges/replaces.

CREATE TABLE "DiagramLayerSharedPreset" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" VARCHAR(48) NOT NULL,
    "labelKey" VARCHAR(48) NOT NULL,
    "tiers" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagramLayerSharedPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagramLayerSharedPreset_labelKey_key" ON "DiagramLayerSharedPreset"("labelKey");

CREATE INDEX "DiagramLayerSharedPreset_sortOrder_idx" ON "DiagramLayerSharedPreset"("sortOrder");

CREATE TABLE "DiagramLayerSharedAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagramLayerSharedAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiagramLayerSharedAuditLog_createdAt_idx" ON "DiagramLayerSharedAuditLog"("createdAt");

ALTER TABLE "DiagramLayerSharedPreset" ADD CONSTRAINT "DiagramLayerSharedPreset_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagramLayerSharedAuditLog" ADD CONSTRAINT "DiagramLayerSharedAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
