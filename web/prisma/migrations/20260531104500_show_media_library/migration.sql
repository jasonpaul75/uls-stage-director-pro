-- Show media library rows (producer cross-project cues; S3 prefix show-media-library/)

CREATE TABLE "ShowMediaLibraryItem" (
    "id" TEXT NOT NULL,
    "lane" "ShowMediaLane" NOT NULL,
    "fileName" VARCHAR(420) NOT NULL,
    "contentType" VARCHAR(200) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(520) NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowMediaLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShowMediaLibraryItem_storageKey_key" ON "ShowMediaLibraryItem"("storageKey");

CREATE INDEX "ShowMediaLibraryItem_lane_idx" ON "ShowMediaLibraryItem"("lane");

CREATE INDEX "ShowMediaLibraryItem_createdAt_idx" ON "ShowMediaLibraryItem"("createdAt");

ALTER TABLE "ShowMediaLibraryItem" ADD CONSTRAINT "ShowMediaLibraryItem_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
