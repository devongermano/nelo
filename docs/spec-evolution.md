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

## #006: StyleGuide Field Name (TO BE FIXED)

**Status**: 🔧 NEEDS FIX

**Current Implementation**:
```prisma
model StyleGuide {
  rules Json  // Wrong field name
}
```

**Should Match Spec**:
```prisma
model StyleGuide {
  guide Json  // Correct per spec
}
```

**Action Required**: Create migration to rename field.

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