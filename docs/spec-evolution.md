# Spec Evolution Log

**CRITICAL**: This document tracks all intentional improvements to the original spec.
These evolutions OVERRIDE `/docs/spec-pack.md` and must be preserved.

## Reading This Document

Each evolution entry represents a deliberate improvement discovered during implementation.
Future Claude instances and developers MUST respect these evolutions - they are not bugs to fix.

---

## #001: SceneStatus as Enum (2024-08-17)

**Status**: ✅ IMPLEMENTED

**Original Spec** (`/docs/spec-pack.md`):
```prisma
status String @default("draft") // draft|revised|final
```

**Implemented Solution**:
```prisma
enum SceneStatus {
  DRAFT
  REVISED
  FINAL
}

model Scene {
  status SceneStatus @default(DRAFT)
}
```

**Rationale**:
- **Type Safety**: TypeScript gets exact enum types from Prisma client
- **Database Validation**: PostgreSQL rejects invalid values at database level
- **IDE Support**: Autocomplete shows `SceneStatus.DRAFT`, `SceneStatus.REVISED`, etc.
- **Refactoring Safety**: Renaming enum values updates all references automatically
- **Performance**: Enums use 4 bytes vs variable-length strings
- **Self-Documenting**: Schema explicitly shows valid states

**Trade-offs**:
- Pro: Compile-time and runtime safety
- Pro: Better developer experience
- Con: Requires migration to add new statuses (acceptable - status changes should be intentional)

**Files**:
- Schema: `/packages/db/prisma/schema.prisma#L77-81`
- Migration: `/packages/db/prisma/migrations/20250817024146_add_scene_status_enum/`

---

## #002: EntityType as Enum (2024-08-17)

**Status**: ✅ IMPLEMENTED

**Original Spec** (`/docs/spec-pack.md`):
```prisma
type String // CHARACTER|LOCATION|ITEM|ORGANIZATION|OTHER
```

**Should Be**:
```prisma
enum EntityType {
  CHARACTER
  LOCATION
  ITEM
  ORGANIZATION
  OTHER
}

model Entity {
  type EntityType
}
```

**Rationale**:
- Same benefits as SceneStatus enum
- Prevents typos like 'CHARACTEER' or 'location' (wrong case)
- Enables switch statements with exhaustiveness checking

**Implementation Note**: 
When implementing, follow same pattern as SceneStatus migration.

---

## #003: CASCADE Deletes on All Foreign Keys (2024-08-17)

**Status**: ✅ IMPLEMENTED

**Original Spec**: Not specified (implicit CASCADE in some relationships)

**Implemented Solution**:
All foreign key constraints use `ON DELETE CASCADE ON UPDATE CASCADE`

**Rationale**:
- **Data Integrity**: Prevents orphaned records
- **Simplifies Deletion**: No need to manually delete children before parents
- **Transaction Safety**: Atomic deletion of entire hierarchies
- **Common Practice**: Standard for hierarchical data (Project → Book → Chapter → Scene)

**Critical Relationships**:
- Deleting Project cascades to all Books, Chapters, Scenes, Entities, etc.
- Deleting User cascades to Memberships and ProjectMembers
- Deleting Scene cascades to Comments, Suggestions, Snapshots, etc.

**Performance Note**: 
Cascade deletes are efficient with proper indexes (all foreign keys are indexed).

**Files**:
- Migration: `/packages/db/prisma/migrations/20250817024600_add_cascade_deletes/`

---

## #004: Optimistic Locking via Version Fields (2024-08-17)

**Status**: ✅ IMPLEMENTED

**Original Spec**: Not specified

**Implemented Solution**:
Added `version Int @default(1)` to models that support concurrent editing:
- Scene
- Project  
- Book
- Chapter

**Rationale**:
- **Prevents Lost Updates**: Concurrent edits fail gracefully instead of silently overwriting
- **User Experience**: Users are notified of conflicts instead of losing work
- **Audit Trail**: Version history can be tracked
- **Industry Standard**: Common pattern in collaborative applications

**Usage Pattern**:
```typescript
// Update with version check
await prisma.scene.update({
  where: { 
    id: sceneId,
    version: currentVersion // Optimistic lock
  },
  data: {
    content: newContent,
    version: { increment: 1 }
  }
});
```

**Files**:
- Schema: Multiple models in `/packages/db/prisma/schema.prisma`
- Service: `/apps/api/src/scenes/scenes.service.ts#L88-100`

---

## #005: Audit Fields Pattern (FUTURE CONSIDERATION)

**Status**: 🔄 UNDER REVIEW

**Consideration**:
Some models could benefit from audit fields:
- `createdBy: String` - User who created the record
- `updatedBy: String` - User who last updated
- `deletedAt: DateTime?` - Soft delete support
- `deletedBy: String?` - Who soft deleted

**Models to Consider**:
- Snapshot (who created this snapshot?)
- Refactor (who approved this refactor?)
- Comment/Suggestion (already has `author`)

**Decision**: Implement as needed when user tracking is fully designed.

---

## #006: StyleGuide Field Name

**Status**: ✅ IMPLEMENTED

**Original Issue**:
```prisma
model StyleGuide {
  rules Json  // Wrong field name in early implementation
}
```

**Implemented Solution**:
```prisma
model StyleGuide {
  guide Json  // Correct per spec
}
```

**Migration**: Completed in `/packages/db/prisma/migrations/20250817030100_rename_styleguide_field/`

---

## #007: Soft Delete Pattern (PLANNED)

**Status**: 📋 PLANNED

**Proposed Addition**:
Add soft delete fields to core content models:
```prisma
deletedAt DateTime?
deletedBy String?
```

**Target Models**:
- Project, Book, Chapter, Scene
- Entity, CanonFact
- Refactor, Patch, Hunk

**Rationale**:
- **Recovery**: Users can restore accidentally deleted content
- **Audit Trail**: Track deletion history for compliance
- **Referential Integrity**: Maintain references without cascade delete issues
- **Performance**: Deleted records can be archived/purged in batch later

**Trade-offs**:
- Pro: Data recovery capability, audit compliance
- Pro: Undo/restore functionality for users
- Con: Increased storage (mitigated by periodic purge)
- Con: All queries need `deletedAt IS NULL` filter

**Implementation Notes**:
- Default queries exclude soft-deleted records
- Add `includeDeleted` parameter to relevant endpoints
- Create restoration endpoints for OWNER/MAINTAINER roles

---

## #008: Audit Fields Pattern (PLANNED)

**Status**: 📋 PLANNED

**Proposed Addition**:
Add audit fields to track content authorship:
```prisma
createdBy String?  // User ID who created
updatedBy String?  // User ID who last updated
```

**Target Models** (Phase 1):
- Project, Book, Chapter, Scene
- Entity, CanonFact
- StyleGuide, PromptPreset

**Rationale**:
- **Attribution**: Know who created/modified content
- **Collaboration**: Essential for multi-writer projects
- **Accountability**: Track changes for review
- **Analytics**: Understand contribution patterns

**Implementation Notes**:
- Populate from JWT claims in API middleware
- Make nullable for backward compatibility
- Phase 2: Add to all user-generated content models

---

## #009: ModelProfile Tokenization Fields (PLANNED)

**Status**: 📋 PLANNED

**Proposed Expansion**:
```prisma
model ModelProfile {
  // Existing fields...
  maxInputTokens  Int?      // Model's context window
  maxOutputTokens Int?      // Max generation length
  pricing         Json?     // { inputPer1K, outputPer1K, currency }
  tokenizer       String?   // e.g., "tiktoken:gpt-4", "anthropic:claude-3"
  throughputQPS   Int?      // Rate limit in queries per second
  supportsNSFW    Boolean?  @default(false)
}
```

**Rationale**:
- **Cost Estimation**: Calculate costs before generation
- **Token Counting**: Accurate context window management
- **Rate Limiting**: Respect provider limits
- **Model Selection**: Choose appropriate model for content length
- **Content Filtering**: Flag NSFW-capable models

**Integration Points**:
- `/tokenize/estimate` endpoint uses tokenizer field
- Budget enforcement uses pricing field
- Context composer respects maxInputTokens
- Rate limiter uses throughputQPS

---

## #010: Enhanced ETag Format for Optimistic Locking (PLANNED)

**Status**: 📋 PLANNED

**Current Implementation**:
```typescript
// Simple version comparison
if (String(scene.version) !== ifMatch) { throw... }
```

**Proposed Format**:
```typescript
// Standard ETag format
ETag: W/"scene-{id}-v{version}"
// Example: W/"scene-uuid123-v5"
```

**Rationale**:
- **HTTP Standards**: Follows RFC 7232 ETag specification
- **Cache Integration**: Works with CDN/proxy caches
- **Resource Identification**: ETag includes resource type and ID
- **Weak Validation**: W/ prefix indicates semantic equivalence

**Benefits**:
- Standard HTTP semantics
- Better debugging (ETag shows resource and version)
- Future: Strong ETags for byte-for-byte equality

**Implementation**:
```typescript
function generateETag(type: string, id: string, version: number): string {
  return `W/"${type}-${id}-v${version}"`;
}

function parseETag(etag: string): { type: string; id: string; version: number } | null {
  const match = /^W\/"(\w+)-(.+)-v(\d+)"$/.exec(etag);
  if (!match) return null;
  return { type: match[1], id: match[2], version: parseInt(match[3]) };
}
```

---

## #011: E2EE Degrade Response Pattern (PLANNED)

**Status**: 📋 PLANNED

**Scenario**: User has E2EE enabled but selects a cloud AI model

**Response Format**:
```typescript
// HTTP 409 Conflict
{
  "code": "E2EE_INCOMPATIBLE",
  "message": "End-to-end encryption is enabled but the selected model requires cloud processing",
  "options": [
    {
      "action": "USE_LOCAL_MODEL",
      "description": "Switch to a local model (Ollama/LM Studio)"
    },
    {
      "action": "DISABLE_E2EE_FOR_RUN", 
      "description": "Temporarily disable encryption for this generation only"
    },
    {
      "action": "CANCEL",
      "description": "Cancel the generation request"
    }
  ]
}
```

**Client Handling**:
1. Show modal with three options
2. If DISABLE_E2EE_FOR_RUN: Create SecurityEvent, retry without E2EE
3. If USE_LOCAL_MODEL: Switch model selector, retry
4. If CANCEL: Close modal, no action

**Security Event**:
```prisma
model SecurityEvent {
  id        String   @id @default(uuid())
  type      String   // "E2EE_TEMPORARY_DISABLE"
  userId    String
  projectId String
  runId     String?
  metadata  Json?    // { reason, modelProfile, ... }
  createdAt DateTime @default(now())
}
```

**Rationale**:
- **User Control**: Explicit consent for security degradation
- **Audit Trail**: SecurityEvents track exceptions
- **Graceful Degradation**: As specified in spec-pack.md
- **Clear Communication**: Users understand the trade-off

---

## How to Add New Evolutions

When you discover an improvement during implementation:

1. **Analyze** if it's genuinely better than the spec
2. **Add entry** here with next sequential number
3. **Include**:
   - Status (IMPLEMENTED, PENDING, UNDER REVIEW)
   - Original spec quote
   - Implemented/proposed solution
   - Detailed rationale
   - Trade-offs honestly assessed
   - File references
4. **Add code comment**: `// Spec Evolution #001: [reason]`
5. **Never** modify the original `/docs/spec-pack.md`

## Principles

1. **Specs are starting points, not final destinations**
2. **Implementation teaches us things planning cannot**
3. **Type safety > flexibility when building robust systems**
4. **Document why, not just what**
5. **Future developers (including AI) need context**