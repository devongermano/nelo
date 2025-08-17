-- Add performance indexes for common query patterns

-- Scene indexes for optimized queries
CREATE INDEX IF NOT EXISTS "Scene_projectId_index_idx" ON "Scene"("projectId", "index");
CREATE INDEX IF NOT EXISTS "Scene_chapterId_order_idx" ON "Scene"("chapterId", "order");
CREATE INDEX IF NOT EXISTS "Scene_status_idx" ON "Scene"("status");

-- Entity indexes for filtering and searching
CREATE INDEX IF NOT EXISTS "Entity_projectId_type_idx" ON "Entity"("projectId", "type");
CREATE INDEX IF NOT EXISTS "Entity_projectId_name_idx" ON "Entity"("projectId", "name");

-- CanonFact indexes for reveal state queries
CREATE INDEX IF NOT EXISTS "CanonFact_entityId_revealState_idx" ON "CanonFact"("entityId", "revealState");
CREATE INDEX IF NOT EXISTS "CanonFact_revealSceneId_idx" ON "CanonFact"("revealSceneId") WHERE "revealSceneId" IS NOT NULL;

-- User and membership indexes
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_role_idx" ON "ProjectMember"("projectId", "role");
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");

-- Run and cost tracking indexes
CREATE INDEX IF NOT EXISTS "Run_projectId_createdAt_idx" ON "Run"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "Run_projectId_status_idx" ON "Run"("projectId", "status");
CREATE INDEX IF NOT EXISTS "CostEvent_createdAt_idx" ON "CostEvent"("createdAt");

-- Collaboration indexes
CREATE INDEX IF NOT EXISTS "Comment_sceneId_createdAt_idx" ON "Comment"("sceneId", "createdAt");
CREATE INDEX IF NOT EXISTS "Suggestion_sceneId_status_idx" ON "Suggestion"("sceneId", "status");
CREATE INDEX IF NOT EXISTS "CollabSession_sceneId_active_idx" ON "CollabSession"("sceneId", "active");

-- Book and chapter indexes
CREATE INDEX IF NOT EXISTS "Book_projectId_index_idx" ON "Book"("projectId", "index");
CREATE INDEX IF NOT EXISTS "Chapter_bookId_index_idx" ON "Chapter"("bookId", "index");

-- Refactoring indexes
CREATE INDEX IF NOT EXISTS "Refactor_projectId_status_idx" ON "Refactor"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Patch_sceneId_status_idx" ON "Patch"("sceneId", "status");