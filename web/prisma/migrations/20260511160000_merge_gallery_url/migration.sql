-- Single gallery integration: SmugMug hosts Pageant Expressions galleries; keep one URL column.
UPDATE "Project"
SET "postEventSmugMugUrl" = "postEventPageantExpressionsUrl"
WHERE (COALESCE(TRIM("postEventSmugMugUrl"), '') = '')
  AND "postEventPageantExpressionsUrl" IS NOT NULL
  AND COALESCE(TRIM("postEventPageantExpressionsUrl"), '') <> '';

ALTER TABLE "Project" DROP COLUMN "postEventPageantExpressionsUrl";
