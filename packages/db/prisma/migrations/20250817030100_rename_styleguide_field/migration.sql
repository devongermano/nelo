-- Spec Evolution #006: Rename StyleGuide.rules to StyleGuide.guide
-- This migration adds the new 'guide' field and migrates data from 'rules'

-- Add the new 'guide' column
ALTER TABLE "StyleGuide" ADD COLUMN IF NOT EXISTS "guide" JSONB;

-- Migrate existing data from 'rules' to 'guide'
UPDATE "StyleGuide" 
SET "guide" = "rules"
WHERE "rules" IS NOT NULL AND "guide" IS NULL;

-- Set default empty object for NULL values
UPDATE "StyleGuide" 
SET "guide" = '{}'::jsonb 
WHERE "guide" IS NULL;

-- Make guide column NOT NULL
ALTER TABLE "StyleGuide" ALTER COLUMN "guide" SET NOT NULL;

-- Make the old 'rules' column nullable (keeping it temporarily for rollback safety)
-- It will be dropped in a future migration after verifying everything works
ALTER TABLE "StyleGuide" ALTER COLUMN "rules" DROP NOT NULL;