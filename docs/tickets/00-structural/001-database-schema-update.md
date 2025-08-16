# Ticket: 00-structural/001 - Database Schema Update

## Priority
**Critical** - All other features depend on having the correct database schema

## Spec Reference
`/docs/spec-pack.md` sections:
- Section 6: Domain Model & Schema (lines 253-602)
- Prisma Schema excerpt (lines 274-602)

## Dependencies
- 00-structural/000 (Complete Typia Setup) - Must have validation system in place

## Current State
The current Prisma schema (`/packages/db/prisma/schema.prisma`) has:
- ✅ Basic models: Project, Book, Chapter, Scene, Entity, CanonFact, User, Membership
- ✅ Some enums: RunStatus, Role (but incomplete)
- ❌ Scene has only `content` field, missing: `contentMd`, `docCrdt`, `title`, `index`, `status`, `pov`, `tense`, `summary`, `wordCount`
- ❌ Entity missing: `type`, `aliases[]`, `traits[]` fields
- ❌ CanonFact has `content` instead of `fact`, missing: `revealState`, `revealSceneId`, `revealAt`, `confidence`
- ❌ Missing enums: RevealState, SuggestionStatus, RefactorStatus, PatchStatus, HunkStatus, ScopeType
- ❌ Missing models: PromptPreset, Persona, ModelProfile, Comment, Suggestion, CollabSession
- ❌ Role enum only has OWNER and MEMBER (missing MAINTAINER, WRITER, READER)

## Target State
Complete Prisma schema matching the spec-pack.md exactly, with:
- All enums defined (RevealState, SuggestionStatus, RefactorStatus, PatchStatus, HunkStatus, ScopeType)
- Scene model with proper fields (title, index, status, pov, tense, contentMd, docCrdt, summary, wordCount)
- Complete Entity model with type, aliases[], traits[]
- CanonFact with RevealState and reveal conditions
- All missing models added
- Proper relationships and indexes

## Acceptance Criteria
- [ ] All enums from spec are defined in schema.prisma
- [ ] Scene model has ALL fields from spec:
  - [ ] `contentMd` (String) - Markdown content
  - [ ] `docCrdt` (Json) - CRDT document
  - [ ] `title` (String?)
  - [ ] `index` (Int)
  - [ ] `status` (String @default("draft"))
  - [ ] `pov` (String?)
  - [ ] `tense` (String?)
  - [ ] `summary` (String?)
  - [ ] `wordCount` (Int @default(0))
- [ ] Entity model updated:
  - [ ] `type` (String)
  - [ ] `aliases` (String[])
  - [ ] `traits` (String[])
- [ ] CanonFact model updated:
  - [ ] `fact` (String) - renamed from content
  - [ ] `revealState` (RevealState)
  - [ ] `revealSceneId` (String?)
  - [ ] `revealAt` (DateTime?)
  - [ ] `confidence` (Int @default(100))
- [ ] All models from spec exist
- [ ] Role enum includes all values
- [ ] Migration runs successfully
- [ ] No data loss for existing records

## Implementation Steps

1. **Update enums in schema.prisma**:
   ```prisma
   enum Role { OWNER MAINTAINER WRITER READER }
   enum RevealState { PLANNED REVEALED REDACTED_UNTIL_SCENE REDACTED_UNTIL_DATE }
   enum SuggestionStatus { OPEN APPLIED DISMISSED }
   enum EntityType { CHARACTER LOCATION ITEM ORGANIZATION OTHER }
   enum RevealState { PLANNED REVEALED REDACTED_UNTIL_SCENE REDACTED_UNTIL_DATE }
   enum RefactorStatus { DRAFT PREVIEW APPLIED PARTIAL DISCARDED }
   enum PatchStatus { PROPOSED ACCEPTED REJECTED APPLIED FAILED }
   enum HunkStatus { PROPOSED ACCEPTED REJECTED APPLIED FAILED }
   enum ScopeType { SCENE CHAPTER BOOK PROJECT CUSTOM }
   ```

2. **Update Scene model**:
   ```prisma
   model Scene {
     id         String   @id @default(uuid())
     chapter    Chapter  @relation(fields: [chapterId], references: [id])
     chapterId  String
     project    Project  @relation(fields: [projectId], references: [id])
     projectId  String
     title      String?
     index      Int
     status     String   @default("draft") // draft|revised|final
     pov        String?  // Point of view character
     tense      String?  // past|present|future
     contentMd  String?  // Markdown content (canonical)
     docCrdt    Json     // Yjs CRDT document
     summary    String?
     wordCount  Int      @default(0)
     embedding  Unsupported("vector")?
     order      Int?
     version    Int      @default(1)
     createdAt  DateTime @default(now())
     updatedAt  DateTime @updatedAt
     // ... relations
   }
   ```

3. **Update Entity model**:
   ```prisma
   model Entity {
     id        String   @id @default(uuid())
     project   Project  @relation(fields: [projectId], references: [id])
     projectId String
     name      String
     type      String   // CHARACTER|LOCATION|ITEM|ORGANIZATION|OTHER
     aliases   String[] // Alternative names
     traits    String[] // Key characteristics
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     // ... relations
   }
   ```

4. **Update CanonFact model**:
   ```prisma
   model CanonFact {
     id            String      @id @default(uuid())
     entity        Entity      @relation(fields: [entityId], references: [id])
     entityId      String
     fact          String      // The canonical fact
     revealState   RevealState @default(PLANNED)
     revealSceneId String?     // Scene where fact is revealed
     revealAt      DateTime?   // Date when fact becomes known
     confidence    Int         @default(100) // 0-100 confidence score
     createdAt     DateTime    @default(now())
   }
   ```

5. **Add missing models**:
   ```prisma
   model PromptPreset {
     id   String @id @default(uuid())
     name String
     text String
     project   Project? @relation(fields: [projectId], references: [id])
     projectId String?
   }
   
   model Persona {
     id   String @id @default(uuid())
     name String
     style String
     project   Project? @relation(fields: [projectId], references: [id])
     projectId String?
   }
   
   model ModelProfile {
     id       String @id @default(uuid())
     name     String
     provider String
     config   Json
     project   Project? @relation(fields: [projectId], references: [id])
     projectId String?
   }
   
   model Comment {
     id      String @id @default(uuid())
     sceneId String
     scene   Scene  @relation(fields: [sceneId], references: [id])
     author  String
     text    String
     range   Json?
     createdAt DateTime @default(now())
   }
   
   model Suggestion {
     id      String @id @default(uuid())
     sceneId String
     scene   Scene  @relation(fields: [sceneId], references: [id])
     author  String
     text    String
     status  SuggestionStatus @default(OPEN)
     range   Json?
     createdAt DateTime @default(now())
   }
   
   model CollabSession {
     id        String   @id @default(uuid())
     sceneId   String
     scene     Scene    @relation(fields: [sceneId], references: [id])
     users     String[] // Array of user IDs in session
     active    Boolean  @default(true)
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

6. **Update relationships**:
   - Ensure all foreign keys are properly defined
   - Add missing relation fields

7. **Create migration**:
   ```bash
   cd packages/db
   # First, create a migration without applying it to review changes
   pnpm prisma migrate dev --create-only --name update_schema_to_spec
   # Review the migration SQL file
   # Then apply it
   pnpm prisma migrate dev
   ```

8. **Update generated client**:
   ```bash
   pnpm prisma generate
   ```

## Testing Requirements

1. **Migration test**:
   - Migration applies cleanly to empty database
   - Migration handles existing data without loss
   - Test data migration for renamed fields (content → fact)
   - Verify default values are applied

2. **Model tests** (`/packages/db/tests/schema.test.ts`):
   - Create test for each new model
   - Verify all fields are accessible
   - Test enum values
   - Test array fields (aliases, traits)

3. **Relationship tests**:
   - Test foreign key constraints
   - Test cascade deletes where appropriate

## Files to Modify/Create
- `/packages/db/prisma/schema.prisma` - Update schema
- `/packages/db/prisma/migrations/` - New migration will be created
- `/packages/db/tests/schema.test.ts` - Create to test new models

## Validation Commands
```bash
# Run from project root
cd packages/db

# Generate and apply migration
pnpm prisma migrate dev

# Generate client
pnpm prisma generate

# Run tests
pnpm test

# Verify schema is valid
pnpm prisma validate

# Check that the API still builds
cd ../../apps/api
pnpm typecheck
```

## Notes
- This is a breaking change - coordinate with team if deploying to production
- Backup any existing data before applying migration
- The `content` → `contentMd` rename in Scene requires data migration
- The `content` → `fact` rename in CanonFact requires data migration
- Consider adding database indexes for frequently queried fields:
  - Scene: (projectId, index), (chapterId, order)
  - Entity: (projectId, type), (projectId, name)
  - CanonFact: (entityId, revealState)
- After this ticket, all other features can reference the correct models