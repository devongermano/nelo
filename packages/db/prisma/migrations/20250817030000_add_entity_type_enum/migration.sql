-- Spec Evolution #002: Add EntityType enum
-- This migration adds the EntityType enum and migrates existing string values

-- Create the EntityType enum
CREATE TYPE "EntityType" AS ENUM ('CHARACTER', 'LOCATION', 'ITEM', 'ORGANIZATION', 'OTHER');

-- Add a temporary column for the new enum type
ALTER TABLE "Entity" ADD COLUMN "type_new" "EntityType";

-- Migrate existing data from string to enum
UPDATE "Entity" 
SET "type_new" = 
  CASE 
    WHEN UPPER("type") = 'CHARACTER' THEN 'CHARACTER'::"EntityType"
    WHEN UPPER("type") = 'LOCATION' THEN 'LOCATION'::"EntityType"
    WHEN UPPER("type") = 'ITEM' THEN 'ITEM'::"EntityType"
    WHEN UPPER("type") = 'ORGANIZATION' THEN 'ORGANIZATION'::"EntityType"
    ELSE 'OTHER'::"EntityType"
  END;

-- Set default for any NULL values
UPDATE "Entity" SET "type_new" = 'OTHER'::"EntityType" WHERE "type_new" IS NULL;

-- Make the new column NOT NULL
ALTER TABLE "Entity" ALTER COLUMN "type_new" SET NOT NULL;

-- Drop the old column and rename the new one
ALTER TABLE "Entity" DROP COLUMN "type";
ALTER TABLE "Entity" RENAME COLUMN "type_new" TO "type";