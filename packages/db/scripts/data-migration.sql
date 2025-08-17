-- Data Migration Script for Nelo Database Schema Update
-- This script handles data migrations for field renames
-- Run this AFTER applying the schema migration but BEFORE using the application

-- IMPORTANT: Always backup your database before running this script!
-- Run: ./scripts/backup.sh

BEGIN;

-- ============================================================================
-- Scene table: content → contentMd migration
-- ============================================================================

-- Check if we need to migrate (old 'content' column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Scene' 
        AND column_name = 'content'
        AND table_schema = 'public'
    ) THEN
        
        -- Migrate data from 'content' to 'contentMd'
        UPDATE "Scene" 
        SET "contentMd" = "content"
        WHERE "content" IS NOT NULL 
        AND "contentMd" IS NULL;
        
        RAISE NOTICE 'Migrated Scene.content to Scene.contentMd';
        
        -- Drop the old column (if schema migration hasn't done it)
        ALTER TABLE "Scene" DROP COLUMN IF EXISTS "content";
        
    ELSE
        RAISE NOTICE 'Scene.content column not found - migration not needed';
    END IF;
END $$;

-- ============================================================================
-- CanonFact table: content → fact migration
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'CanonFact' 
        AND column_name = 'content'
        AND table_schema = 'public'
    ) THEN
        
        -- Migrate data from 'content' to 'fact'
        UPDATE "CanonFact" 
        SET "fact" = "content"
        WHERE "content" IS NOT NULL 
        AND "fact" IS NULL;
        
        RAISE NOTICE 'Migrated CanonFact.content to CanonFact.fact';
        
        -- Drop the old column (if schema migration hasn't done it)
        ALTER TABLE "CanonFact" DROP COLUMN IF EXISTS "content";
        
    ELSE
        RAISE NOTICE 'CanonFact.content column not found - migration not needed';
    END IF;
END $$;

-- ============================================================================
-- Set default values for new required fields
-- ============================================================================

-- Scene: Ensure all scenes have required fields
UPDATE "Scene" 
SET 
    "index" = 0 
WHERE "index" IS NULL;

UPDATE "Scene" 
SET 
    "status" = 'draft' 
WHERE "status" IS NULL OR "status" = '';

UPDATE "Scene" 
SET 
    "docCrdt" = '{}' 
WHERE "docCrdt" IS NULL;

UPDATE "Scene" 
SET 
    "wordCount" = 0 
WHERE "wordCount" IS NULL;

-- Entity: Set default type if missing
UPDATE "Entity" 
SET 
    "type" = 'OTHER' 
WHERE "type" IS NULL OR "type" = '';

-- Entity: Initialize empty arrays if NULL
UPDATE "Entity" 
SET 
    "aliases" = '{}' 
WHERE "aliases" IS NULL;

UPDATE "Entity" 
SET 
    "traits" = '{}' 
WHERE "traits" IS NULL;

-- CanonFact: Set default values
UPDATE "CanonFact" 
SET 
    "revealState" = 'PLANNED' 
WHERE "revealState" IS NULL;

UPDATE "CanonFact" 
SET 
    "confidence" = 100 
WHERE "confidence" IS NULL;

-- ============================================================================
-- Data validation checks
-- ============================================================================

-- Check for any scenes without contentMd (warn if found)
DO $$
DECLARE
    empty_scenes INTEGER;
BEGIN
    SELECT COUNT(*) INTO empty_scenes
    FROM "Scene" 
    WHERE "contentMd" IS NULL;
    
    IF empty_scenes > 0 THEN
        RAISE WARNING '% scenes have NULL contentMd - you may want to review these', empty_scenes;
    END IF;
END $$;

-- Check for any entities without type
DO $$
DECLARE
    untyped_entities INTEGER;
BEGIN
    SELECT COUNT(*) INTO untyped_entities
    FROM "Entity" 
    WHERE "type" IS NULL OR "type" = '';
    
    IF untyped_entities > 0 THEN
        RAISE WARNING '% entities have no type - defaulted to OTHER', untyped_entities;
    END IF;
END $$;

-- ============================================================================
-- Update word counts for existing scenes
-- ============================================================================

-- Calculate word count for existing scenes based on contentMd
UPDATE "Scene"
SET "wordCount" = (
    SELECT COUNT(*)
    FROM regexp_split_to_table("contentMd", '\s+') AS word
    WHERE LENGTH(word) > 0
)
WHERE "contentMd" IS NOT NULL 
AND "wordCount" = 0;

-- ============================================================================
-- Migration summary
-- ============================================================================

DO $$
DECLARE
    scene_count INTEGER;
    entity_count INTEGER;
    fact_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO scene_count FROM "Scene";
    SELECT COUNT(*) INTO entity_count FROM "Entity";
    SELECT COUNT(*) INTO fact_count FROM "CanonFact";
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Data Migration Complete ===';
    RAISE NOTICE 'Scenes migrated: %', scene_count;
    RAISE NOTICE 'Entities processed: %', entity_count;
    RAISE NOTICE 'Canon facts migrated: %', fact_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Please verify your data and run application tests.';
END $$;

COMMIT;

-- ============================================================================
-- Rollback instructions (save for emergency use)
-- ============================================================================

-- To rollback Scene changes:
-- ALTER TABLE "Scene" ADD COLUMN "content" TEXT;
-- UPDATE "Scene" SET "content" = "contentMd";
-- ALTER TABLE "Scene" DROP COLUMN "contentMd";

-- To rollback CanonFact changes:
-- ALTER TABLE "CanonFact" ADD COLUMN "content" TEXT;
-- UPDATE "CanonFact" SET "content" = "fact";
-- ALTER TABLE "CanonFact" DROP COLUMN "fact";