-- Add CASCADE deletes to foreign key constraints

-- User relationships
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" DROP CONSTRAINT "Membership_teamId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project relationships
ALTER TABLE "Book" DROP CONSTRAINT "Book_projectId_fkey";
ALTER TABLE "Book" ADD CONSTRAINT "Book_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entity" DROP CONSTRAINT "Entity_projectId_fkey";
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromptPreset" DROP CONSTRAINT "PromptPreset_projectId_fkey";
ALTER TABLE "PromptPreset" ADD CONSTRAINT "PromptPreset_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Persona" DROP CONSTRAINT "Persona_projectId_fkey";
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModelProfile" DROP CONSTRAINT "ModelProfile_projectId_fkey";
ALTER TABLE "ModelProfile" ADD CONSTRAINT "ModelProfile_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContextRule" DROP CONSTRAINT "ContextRule_projectId_fkey";
ALTER TABLE "ContextRule" ADD CONSTRAINT "ContextRule_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Budget" DROP CONSTRAINT "Budget_projectId_fkey";
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Run" DROP CONSTRAINT "Run_projectId_fkey";
ALTER TABLE "Run" ADD CONSTRAINT "Run_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Refactor" DROP CONSTRAINT "Refactor_projectId_fkey";
ALTER TABLE "Refactor" ADD CONSTRAINT "Refactor_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StyleGuide" DROP CONSTRAINT "StyleGuide_projectId_fkey";
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Book relationships
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_bookId_fkey";
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" 
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chapter relationships
ALTER TABLE "Scene" DROP CONSTRAINT "Scene_chapterId_fkey";
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_chapterId_fkey" 
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scene relationships
ALTER TABLE "Scene" DROP CONSTRAINT "Scene_projectId_fkey";
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" DROP CONSTRAINT "Comment_sceneId_fkey";
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_sceneId_fkey";
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollabSession" DROP CONSTRAINT "CollabSession_sceneId_fkey";
ALTER TABLE "CollabSession" ADD CONSTRAINT "CollabSession_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Snapshot" DROP CONSTRAINT "Snapshot_sceneId_fkey";
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sentence" DROP CONSTRAINT "Sentence_sceneId_fkey";
ALTER TABLE "Sentence" ADD CONSTRAINT "Sentence_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SceneEntity" DROP CONSTRAINT "SceneEntity_sceneId_fkey";
ALTER TABLE "SceneEntity" ADD CONSTRAINT "SceneEntity_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SceneEntity" DROP CONSTRAINT "SceneEntity_entityId_fkey";
ALTER TABLE "SceneEntity" ADD CONSTRAINT "SceneEntity_entityId_fkey" 
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Entity relationships
ALTER TABLE "CanonFact" DROP CONSTRAINT "CanonFact_entityId_fkey";
ALTER TABLE "CanonFact" ADD CONSTRAINT "CanonFact_entityId_fkey" 
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Embedding" DROP CONSTRAINT "Embedding_entityId_fkey";
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_entityId_fkey" 
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Run relationships
ALTER TABLE "CostEvent" DROP CONSTRAINT "CostEvent_runId_fkey";
ALTER TABLE "CostEvent" ADD CONSTRAINT "CostEvent_runId_fkey" 
  FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Refactor relationships
ALTER TABLE "Patch" DROP CONSTRAINT "Patch_refactorId_fkey";
ALTER TABLE "Patch" ADD CONSTRAINT "Patch_refactorId_fkey" 
  FOREIGN KEY ("refactorId") REFERENCES "Refactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Patch" DROP CONSTRAINT "Patch_sceneId_fkey";
ALTER TABLE "Patch" ADD CONSTRAINT "Patch_sceneId_fkey" 
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Patch relationships
ALTER TABLE "Hunk" DROP CONSTRAINT "Hunk_patchId_fkey";
ALTER TABLE "Hunk" ADD CONSTRAINT "Hunk_patchId_fkey" 
  FOREIGN KEY ("patchId") REFERENCES "Patch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hunk relationships
ALTER TABLE "EditSpan" DROP CONSTRAINT "EditSpan_hunkId_fkey";
ALTER TABLE "EditSpan" ADD CONSTRAINT "EditSpan_hunkId_fkey" 
  FOREIGN KEY ("hunkId") REFERENCES "Hunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;