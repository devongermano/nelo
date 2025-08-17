-- Restore indexes that were accidentally dropped

-- Scene indexes
CREATE INDEX "scene_project_index" ON "Scene"("projectId", "index");
CREATE INDEX "scene_chapter_order" ON "Scene"("chapterId", "order");
CREATE INDEX "scene_status" ON "Scene"("status");

-- Entity indexes
CREATE INDEX "entity_project_type" ON "Entity"("projectId", "type");
CREATE INDEX "entity_project_name" ON "Entity"("projectId", "name");

-- Canon fact indexes
CREATE INDEX "canon_fact_reveal" ON "CanonFact"("revealState", "revealSceneId");

-- Membership indexes
CREATE INDEX "membership_lookup" ON "Membership"("userId", "teamId");

-- Project member indexes
CREATE INDEX "project_member_lookup" ON "ProjectMember"("userId", "projectId");