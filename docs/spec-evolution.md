# Spec Evolution - IMPLEMENTATION SOURCE OF TRUTH

## 🚨 CRITICAL: How to Read This Document (Humans & LLMs)

**THREE SIMPLE RULES:**
1. If a model/feature appears below → **USE THAT VERSION** (ignore spec-pack.md)
2. If NOT found below → use spec-pack.md version
3. **NEVER** mentally merge specs - use complete definitions

**This document contains COMPLETE REPLACEMENTS, not deltas.**

Each evolution entry represents a deliberate improvement discovered during implementation.
These evolutions OVERRIDE `/docs/spec-pack.md` and must be preserved.

---

## 📋 Baseline Corrections

The following corrections to spec-pack.md were implemented from the initial baseline migration.
These are NOT evolutions - they are corrections to spec errors that were caught before implementation began:

### Entity.projectId Required
- **Spec Error** (`spec-pack.md` line 382): Entity model lacks projectId field
- **Baseline Implementation**: Entity has projectId for proper multi-tenant isolation
- **Evidence**: `/packages/db/prisma/migrations/20250817000000_baseline/migration.sql` line 142
- **Rationale**: Without projectId, entities would leak across projects, breaking RBAC and data isolation

### Version Fields for Optimistic Locking
- **Spec Omission**: No version fields specified for concurrent editing
- **Baseline Implementation**: Project, Book, Chapter, Scene all have `version INT DEFAULT 1`
- **Evidence**: Baseline migration includes version fields on all major entities
- **Rationale**: Required for safe concurrent editing and conflict detection

### Scene Additional Fields
- **Spec Omission**: No embedding or custom ordering fields
- **Baseline Implementation**: Scene has `embedding Unsupported("vector")?` and `order Int?`
- **Evidence**: Present in baseline schema
- **Rationale**: 
  - `embedding`: Enables semantic search and similarity matching for scenes
  - `order`: Allows custom scene ordering independent of index

These baseline corrections are foundational and must be preserved.

---

## 📚 COMPLETE MODEL DEFINITIONS

When a model appears in this section, implement **EXACTLY** this version. These are complete replacements, not modifications.

**Models appear here when they:**
- Have evolutions applied (e.g., enums, renamed fields, version fields)
- Differ from the original spec-pack.md specification
- Are planned for significant changes (in PLANNED section)
- Have baseline corrections that affect their structure

**Note on CASCADE Deletes**: Evolution #003 applies CASCADE deletes to all foreign keys via migration. These are NOT shown in the schema.prisma file or in the models below - they're applied at the database level through migration `20250817024600_add_cascade_deletes`.

### ✅ IMPLEMENTED MODELS (Use These Versions)

#### Scene Model (CURRENT STATE - Partially Evolved)
**Implemented Evolutions**: #001 (SceneStatus enum), #004 (version field)
**Planned Evolutions**: #022 (CRDT split), #023 (TextChunk), #026 (POV/Tense enums)
**Status**: ✅ Core structure IMPLEMENTED, some evolutions pending

```prisma
enum SceneStatus {
  DRAFT
  REVISED
  FINAL
}

model Scene {
  id             String          @id @default(uuid())
  chapter        Chapter         @relation(fields: [chapterId], references: [id])
  chapterId      String
  project        Project         @relation(fields: [projectId], references: [id])
  projectId      String
  title          String?
  index          Int
  status         SceneStatus     @default(DRAFT)     // ← Evolution #001: enum (IMPLEMENTED)
  pov            String?                             // POV enum planned (Evolution #026)
  tense          String?                             // Tense enum planned (Evolution #026)
  contentMd      String?                             // Canonical Markdown
  docCrdt        Json            @default("{}")      // Will be split (Evolution #022)
  summary        String?
  wordCount      Int             @default(0)
  embedding      Unsupported("vector")?              // For similarity search
  order          Int?                                // Custom ordering
  version        Int             @default(1)         // ← Evolution #004: optimistic locking
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  // Relations
  snapshots      Snapshot[]
  sentences      Sentence[]      // Will become textChunks (Evolution #023)
  entities       SceneEntity[]
  runs           Run[]
  patches        Patch[]
  comments       Comment[]       // Will use anchorId (Evolution #021)
  suggestions    Suggestion[]    // Will use anchorId (Evolution #021)
  collabSessions CollabSession[]
}
```

#### Entity Model (REPLACES spec-pack version)
**Evolutions Applied**: #002 (EntityType enum), Baseline (projectId)
**Status**: ✅ IMPLEMENTED

```prisma
enum EntityType {
  CHARACTER
  LOCATION
  ITEM
  ORGANIZATION
  OTHER
}

model Entity {
  id        String      @id @default(uuid())
  project   Project     @relation(fields: [projectId], references: [id])
  projectId String      // ← Baseline correction: required for isolation
  type      EntityType  // ← Evolution #002: enum not String
  name      String
  aliases   String[]
  traits    String[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  
  // Relations
  scenes     SceneEntity[]
  canonFacts CanonFact[]
  embeddings Embedding[]  // Currently Entity-only (will be polymorphic in Evolution #023)
}
```

#### StyleGuide Model (REPLACES spec-pack version)
**Evolutions Applied**: #006 (renamed field)
**Status**: ✅ IMPLEMENTED

```prisma
model StyleGuide {
  id        String   @id @default(uuid())
  project   Project  @relation(fields: [projectId], references: [id])
  projectId String
  name      String
  guide     Json     // ← Evolution #006: renamed from 'rules' to 'guide'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Embedding Model (CURRENT STATE - Pre-Evolution)
**Evolutions Applied**: None (Evolution #023 planned)
**Status**: ✅ IMPLEMENTED (basic version)
**Note**: Currently tied to Entity only. Evolution #023 will make it polymorphic.

```prisma
model Embedding {
  id        String                 @id @default(uuid())
  entity    Entity                 @relation(fields: [entityId], references: [id])
  entityId  String                 // Will become targetId with targetType (Evolution #023)
  embedding Unsupported("vector")
  createdAt DateTime               @default(now())
  
  @@index([embedding], map: "embedding_idx")
}
```

#### Project Model (REPLACES spec-pack version)
**Evolutions Applied**: #004 (version field)
**Status**: ✅ IMPLEMENTED

```prisma
model Project {
  id           String          @id @default(uuid())
  name         String
  slug         String          @unique
  version      Int             @default(1)     // ← Evolution #004: optimistic locking
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  
  // Relations
  books        Book[]
  members      ProjectMember[]
  budgets      Budget[]
  entities     Entity[]
  scenes       Scene[]
  styleGuides  StyleGuide[]
  contextRules ContextRule[]
  runs         Run[]
  refactors    Refactor[]
  prompts      PromptPreset[]
  personas     Persona[]
  models       ModelProfile[]
}
```

#### Book Model (REPLACES spec-pack version)
**Evolutions Applied**: #004 (version field)
**Status**: ✅ IMPLEMENTED

```prisma
model Book {
  id        String    @id @default(uuid())
  project   Project   @relation(fields: [projectId], references: [id])
  projectId String
  title     String
  index     Int
  version   Int       @default(1)     // ← Evolution #004: optimistic locking
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  // Relations
  chapters  Chapter[]
}
```

#### Chapter Model (REPLACES spec-pack version)
**Evolutions Applied**: #004 (version field), Baseline (order field)
**Status**: ✅ IMPLEMENTED

```prisma
model Chapter {
  id        String   @id @default(uuid())
  book      Book     @relation(fields: [bookId], references: [id])
  bookId    String
  title     String
  index     Int
  order     Int?     // ← Baseline: custom ordering
  version   Int      @default(1)     // ← Evolution #004: optimistic locking
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  scenes    Scene[]
}
```

### 📋 PLANNED MODELS (To Be Implemented)

#### POV & Tense Enums (Evolution #026)
**Evolution**: #026 (POV & Tense Enums)
**Status**: 📋 PLANNED
**Purpose**: Type safety for narrative perspective and tense

```prisma
enum POV {
  FIRST
  SECOND
  THIRD
  OMNISCIENT
}

enum Tense {
  PAST
  PRESENT
  FUTURE
}

// Will update Scene model:
model Scene {
  // ... other fields ...
  pov   POV?    // Currently String?
  tense Tense?  // Currently String?
  // ... rest of model ...
}
```

#### Anchor Model (NEW)
**Evolution**: #021 (Unified Anchor System)
**Status**: 📋 PLANNED
**Purpose**: Replace fragmented anchoring (range, yjsAnchor, textAnchor) with unified system

```prisma
model Anchor {
  id        String   @id @default(uuid())
  scene     Scene    @relation(fields: [sceneId], references: [id])
  sceneId   String
  
  // Dual anchoring for resilience
  yjs       Json?    // Yjs RelativePositions {start, end}
  text      Json?    // {beforeKGramHash, afterKGramHash, approxOffset}
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  comments    Comment[]
  suggestions Suggestion[]
  editSpans   EditSpan[]
  textChunks  TextChunk[]
}
```

#### Comment Model (UPDATED)
**Evolution**: #021 (Use unified anchor)
**Status**: 📋 PLANNED update

```prisma
model Comment {
  id        String   @id @default(uuid())
  scene     Scene    @relation(fields: [sceneId], references: [id])
  sceneId   String
  author    String
  text      String
  
  anchorId  String?  // ← Evolution #021: replaces 'range Json?'
  anchor    Anchor?  @relation(fields: [anchorId], references: [id])
  
  createdAt DateTime @default(now())
}
```

#### Suggestion Model (UPDATED)
**Evolution**: #021 (Use unified anchor)
**Status**: 📋 PLANNED update

```prisma
model Suggestion {
  id        String           @id @default(uuid())
  scene     Scene            @relation(fields: [sceneId], references: [id])
  sceneId   String
  author    String
  text      String
  status    SuggestionStatus @default(OPEN)
  
  anchorId  String?          // ← Evolution #021: replaces 'range Json?'
  anchor    Anchor?          @relation(fields: [anchorId], references: [id])
  
  createdAt DateTime         @default(now())
}
```

#### TextChunk Model (REPLACES Sentence)
**Evolution**: #023 (TextChunk & Generalized Embeddings)
**Status**: 📋 PLANNED
**Purpose**: Replace brittle Sentence model with robust chunking

```prisma
enum ChunkType {
  PARAGRAPH
  SENTENCE
}

model TextChunk {
  id        String    @id @default(uuid())
  scene     Scene     @relation(fields: [sceneId], references: [id])
  sceneId   String
  kind      ChunkType
  text      String
  index     Int
  
  anchorId  String?   // ← Evolution #021: resilient positioning
  anchor    Anchor?   @relation(fields: [anchorId], references: [id])
  
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  // Relations
  embeddings Embedding[] // ← Via polymorphic targetType
  
  @@index([sceneId, kind, index])
}
```

#### Embedding Model (UPDATED)
**Evolution**: #023 (Polymorphic targeting)
**Status**: 📋 PLANNED replacement

```prisma
enum EmbeddingTarget {
  ENTITY
  TEXT_CHUNK
}

model Embedding {
  id         String          @id @default(uuid())
  project    Project         @relation(fields: [projectId], references: [id])
  projectId  String
  
  targetType EmbeddingTarget // ← Evolution #023: polymorphic
  targetId   String          // ← entityId OR textChunkId
  
  embedding  Unsupported("vector(1536)")
  model      String          // Track which AI model created this
  
  createdAt  DateTime        @default(now())
  
  @@index([projectId, targetType, targetId])
  @@index([embedding], map: "embedding_hnsw_idx")
}
```

#### Doc & DocUpdate Models (NEW)
**Evolution**: #022 (Split CRDT Storage)
**Status**: 📋 PLANNED
**Purpose**: Replace Scene.docCrdt with performant split storage

```prisma
model Doc {
  id        String   @id @default(uuid())
  scene     Scene    @relation(fields: [sceneId], references: [id])
  sceneId   String   @unique
  
  snapshot  Bytes    // Compressed Yjs snapshot
  vector    Bytes    // State vector for the snapshot
  size      Int      // Uncompressed size in bytes
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  updates   DocUpdate[]
}

model DocUpdate {
  id        String   @id @default(uuid())
  doc       Doc      @relation(fields: [docId], references: [id])
  docId     String
  
  update    Bytes    // Incremental update
  clientId  String   // Which client created this
  seq       Int      // Sequence number for ordering
  
  createdAt DateTime @default(now())
  
  @@index([docId, seq])
  @@index([createdAt]) // For rollup queries
}
```

#### ProviderKey Model (UPDATED)
**Evolution**: #029 (Multi-scope ownership)
**Status**: 📋 PLANNED update

```prisma
enum OwnerType {
  USER
  TEAM
  PROJECT
}

model ProviderKey {
  id        String    @id @default(uuid())
  
  ownerType OwnerType // ← Evolution #029: flexible ownership
  ownerId   String    // ← userId, teamId, or projectId
  
  provider  String    // openai|anthropic|openrouter|mistral|ollama|lmstudio
  label     String
  enc       Bytes     // Encrypted API key
  meta      Json?
  
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  @@index([ownerType, ownerId])
}
```

#### CanonFact Model (UPDATED)
**Evolution**: #030 (Provenance tracking)
**Status**: 📋 PLANNED update

```prisma
model CanonFact {
  id            String      @id @default(uuid())
  entity        Entity      @relation(fields: [entityId], references: [id])
  entityId      String
  
  fact          String
  revealState   RevealState
  revealSceneId String?
  revealAt      DateTime?
  confidence    Int         @default(100)
  
  provenance    Json?       // ← Evolution #030: {sceneId, anchorId, confidence, snippet}
  
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  @@index([entityId, revealState])
}
```

### ❌ REMOVED FROM IMPLEMENTATION

#### Sentence Model
**Replaced by**: TextChunk (Evolution #023)
**Reason**: Brittle under CRDT churn, poor chunking boundaries

---

## 📡 WEBSOCKET EVENTS (Complete Definitions)

Use these exact event schemas for WebSocket communication:

### Handshake Events
```typescript
// Client initiates connection
client.hello → {
  userId: string,
  projectId: string,
  sceneId: string,
  e2ee: boolean,
  token: string
}

// Server acknowledges with capabilities
server.ready → {
  sessionId: string,
  capabilities: ['presence', 'crdt', 'stream', 'cost', 'e2ee']  // ← Added 'e2ee'
}
```

### Presence Events
```typescript
// User cursor/selection updates
presence.update → {
  userId: string,
  cursor: { from: number, to: number },
  color: string
}

// Presence list broadcast
presence.list → UserPresence[]
```

### Document Sync Events
```typescript
// CRDT document updates
editor.update → {
  sceneId: string,
  ydocUpdateBase64: string  // Opaque CRDT delta
}

// Document sync from server
doc.sync → {
  sceneId: string,
  update: string,  // Base64 compressed update
  isIncremental: boolean
}
```

### Comment & Suggestion Events
```typescript
// New comment (uses anchorId, not range)
comment.new → {
  id: string,
  sceneId: string,
  author: string,
  text: string,
  anchorId: string  // ← Evolution #021: unified anchor system
}

// New suggestion (uses anchorId, not range)
suggestion.new → {
  id: string,
  sceneId: string,
  author: string,
  text: string,
  anchorId: string  // ← Evolution #021: unified anchor system
}
```

### Cost Tracking Events
```typescript
// Real-time cost updates
cost.update → {
  runId: string,
  tokensIn: number,
  tokensOut: number,
  costUSD: number
}
```

### Scene Management Events
```typescript
// Join scene for collaboration
join.scene → {
  sceneId: string,
  user: { id: string, name: string },
  stateVector?: string  // For incremental sync
}

// Leave scene
leave.scene → {
  sceneId: string
}
```

---

## #001: SceneStatus as Enum (2025-08-17)

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

## #002: EntityType as Enum (2025-08-17)

**Status**: ✅ IMPLEMENTED

**Original Spec** (`/docs/spec-pack.md`):
```prisma
type String // CHARACTER|LOCATION|ITEM|ORGANIZATION|OTHER
```

**Implemented Solution**:
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

**Files**:
- Schema: `/packages/db/prisma/schema.prisma#L86-92`
- Migration: `/packages/db/prisma/migrations/20250817030000_add_entity_type_enum/`

---

## #003: CASCADE Deletes on All Foreign Keys (2025-08-17)

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

## #004: Optimistic Locking via Version Fields (2025-08-17)

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

**Implementation Ticket**: 01-core/011 (to be created)

---

## #012: Permission Matrix Pattern (PLANNED)

**Status**: 📋 PLANNED

**Concept**: Action-based permission system with role matrix

**Implementation**:
```typescript
type Action = 'project.create' | 'scene.update' | 'ai.generate' | ...;
type Role = 'OWNER' | 'MAINTAINER' | 'WRITER' | 'READER';

const permissions: Record<Action, Role[]> = {
  'project.create': ['OWNER'],
  'scene.update': ['OWNER', 'MAINTAINER', 'WRITER'],
  'ai.generate': ['OWNER', 'MAINTAINER', 'WRITER'],
  // ...
};
```

**Rationale**:
- **Fine-grained Control**: Specific permissions per action
- **Maintainable**: Central permission matrix
- **Auditable**: Clear who can do what
- **Extensible**: Easy to add new actions

**Documentation**: `/docs/permissions.md` (created)
**Implementation Ticket**: 00-structural/007

---

## #013: Tokenizer Registry Pattern (PLANNED)

**Status**: 📋 PLANNED

**Concept**: Pluggable tokenizer implementations for different AI models

**Registry Structure**:
```typescript
interface Tokenizer {
  name: string;
  encode(text: string): number[];
  countTokens(text: string): number;
}

class TokenizerRegistry {
  private tokenizers = new Map<string, Tokenizer>();
  
  register(key: string, tokenizer: Tokenizer) { ... }
  get(modelKey: string): Tokenizer { ... }
}
```

**Implementations**:
- `tiktoken:cl100k_base` - GPT-4 models
- `tiktoken:p50k_base` - GPT-3.5 models  
- `anthropic:claude-3` - Claude models
- `heuristic:default` - Fallback estimator

**Rationale**:
- **Accuracy**: Model-specific token counting
- **Cost Estimation**: Pre-generation cost calculation
- **Context Management**: Prevent context window overflow
- **Extensible**: Easy to add new tokenizers

**Implementation Ticket**: 01-core/009

---

## #014: JWT Authentication Foundation (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Permission system and all security features require authentication

**Implementation**:
```typescript
// Using @nestjs/jwt + Passport for industry-standard auth
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ /* ... */ })
  ]
})
```

**Technology Choice**: @nestjs/jwt + Passport over jose or custom
- **617K weekly downloads** vs jose's smaller adoption
- **Native NestJS integration** with guards and strategies
- **Extensive documentation** and community support
- **Battle-tested** in production applications

**Implementation Ticket**: 00-structural/004

---

## #015: Prisma Client Extensions for Soft Delete (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Prisma middleware ($use) deprecated in v5.2.2

**Implementation**:
```typescript
// Using Prisma Client Extensions ($extends) instead of middleware
const prisma = new PrismaClient().$extends({
  model: {
    $allModels: {
      async softDelete() { /* ... */ }
    }
  },
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      }
    }
  }
});
```

**Rationale**:
- **Official recommendation** from Prisma team
- **Type safety** throughout the chain
- **Better performance** than middleware
- **Cleaner API** with custom methods

**Implementation Ticket**: 00-structural/006

---

## #016: Custom Permission Implementation (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Evaluated CASL, Casbin, and custom implementation

**Decision**: **Keep custom implementation** for our simple RBAC

**Rationale**:
- **Simple 4-role system** doesn't justify CASL's complexity
- **Zero dependencies** for core security
- **Better performance** for straightforward checks
- **Easier to understand** and maintain
- Would only use CASL if we needed field-level permissions

**Caching Strategy**: Redis with 5-minute TTL for permission checks

**Implementation Ticket**: 00-structural/007

---

## #017: Official Tiktoken for Tokenization (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Choosing between @dqbd/tiktoken, js-tiktoken, and official tiktoken

**Implementation**:
```bash
# Use official tiktoken package (NOT @dqbd/tiktoken)
pnpm add tiktoken
```

**Performance**: WASM implementation is **3-6x faster** than pure JS

**Rationale**:
- **Official package** with active maintenance
- **WASM performance** near-native speed
- **Last updated within days** (vs months for alternatives)
- **Full feature parity** with OpenAI's Python implementation

**Implementation Ticket**: 01-core/009

---

## #018: Etag Package for Generation (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Standard ETag generation vs custom implementation

**Implementation**:
```typescript
import etag from 'etag';
// Use for generation, keep custom parsing for our format
```

**Rationale**:
- **Mature package** (8+ years, widely used)
- **Handles edge cases** properly
- **Standard-compliant** output
- Custom parsing maintained for backward compatibility

**Implementation Ticket**: 00-structural/008

---

## #019: Enhanced Rate Limiting with Redis (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Production-ready rate limiting for multi-instance deployment

**Implementation**:
- Continue using **@nestjs/throttler**
- Add **Redis storage** for distributed systems
- **Per-user tracking** (not just IP)
- **Role-based multipliers** (OWNER: 3x, WRITER: 1.5x)
- **Cost-based AI throttling** with daily token limits

**Implementation Ticket**: 00-structural/010

---

## #020: LemonSqueezy for MVP Billing (2025-08-17)

**Status**: 📋 PLANNED

**Context**: Billing provider choice for SaaS deployment

**Decision**: **LemonSqueezy for MVP**, migrate to Stripe at scale

**Rationale**:
- **Merchant of Record** = no tax compliance headaches
- **Fastest setup** with minimal friction
- **One invoice/month** to LemonSqueezy vs thousands to customers
- **Global VAT/GST** handled automatically

**Migration Path**: Start simple → Add Stripe when you need custom logic

**Implementation Ticket**: 01-core/010

---

## 📚 Critical Infrastructure Improvements

## #021: Unified Anchor System (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **CRITICAL**

**Problem**: 
Anchoring is fragmented across the codebase:
- `Comment.range Json?` and `Suggestion.range Json?` use one format
- `EditSpan` uses separate `yjsAnchor` and `textAnchor` fields
- Multiple anchor implementations lead to drift under CRDT churn
- Maintenance cost of multiple systems

**Proposed Solution**:
```prisma
model Anchor {
  id        String   @id @default(uuid())
  scene     Scene    @relation(fields: [sceneId], references: [id])
  sceneId   String
  // Unified robust anchoring
  yjs       Json?    // Yjs RelativePositions (start/end)
  text      Json?    // { beforeKGramHash, afterKGramHash, approxOffset }
  createdAt DateTime @default(now())
}

// Update all models to use unified anchor
model Comment {
  // ... existing fields
  anchorId String?   // Replace range
  anchor   Anchor?   @relation(fields: [anchorId], references: [id])
}

model Suggestion {
  // ... existing fields
  anchorId String?   // Replace range
  anchor   Anchor?   @relation(fields: [anchorId], references: [id])
}

model EditSpan {
  // ... existing fields
  anchorId String?   // Replace yjsAnchor/textAnchor
  anchor   Anchor?   @relation(fields: [anchorId], references: [id])
}
```

**Migration Strategy**:
1. Create Anchor table
2. Backfill from existing ranges and anchors
3. Update models to use anchorId
4. Keep old fields deprecated for one release
5. Drop old fields in next release

**Benefits**:
- **<1% anchor drift** under heavy CRDT editing
- **Single implementation** to maintain and test
- **Consistent behavior** across all features
- **Easier debugging** with centralized anchor logic

**Implementation Ticket**: To be created

---

## #022: Split CRDT Storage (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **CRITICAL**

**Problem**:
- `Scene.docCrdt Json` causes row bloat (can grow to MB size)
- Forces full-row I/O on every CRDT update
- Slow cold loads (>1s for large documents)
- No garbage collection mechanism
- Difficult recovery from corrupted CRDT state

**Proposed Solution**:
```prisma
model Doc {
  id         String   @id @default(uuid())
  scene      Scene    @relation(fields: [sceneId], references: [id])
  sceneId    String   @unique
  snapshot   Bytes?   // Rolled-up CRDT state (compressed)
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt
}

model DocUpdate {
  id        String   @id @default(uuid())
  doc       Doc      @relation(fields: [docId], references: [id])
  docId     String
  update    Bytes    // Yjs update delta (binary)
  createdAt DateTime @default(now())
  
  @@index([docId, createdAt])
}
```

**Migration Strategy**:
1. Create Doc and DocUpdate tables
2. Migrate Scene.docCrdt to Doc.snapshot
3. Future writes append to DocUpdate
4. Periodic roll-up of updates into snapshot
5. Remove Scene.docCrdt after validation

**Performance Improvements**:
- **Cold load**: <100ms (from >1s)
- **Update size**: ~100 bytes vs full document
- **Garbage collection**: Automatic compaction
- **Recovery**: Rebuild from update log if needed

**Implementation Ticket**: To be created

---

## #023: TextChunk & Generalized Embeddings (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **CRITICAL**

**Problem**:
- Only Entity embeddings exist
- No scene/paragraph/sentence chunks for RAG
- Poor retrieval quality for AI context
- Can't do precise global refactoring
- Sentence table is brittle under CRDT churn

**Proposed Solution**:
```prisma
enum ChunkType { 
  PARAGRAPH 
  SENTENCE 
}

model TextChunk {
  id        String   @id @default(uuid())
  scene     Scene    @relation(fields: [sceneId], references: [id])
  sceneId   String
  kind      ChunkType
  anchorId  String?  // Use unified Anchor for resilience
  anchor    Anchor?  @relation(fields: [anchorId], references: [id])
  text      String
  index     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([sceneId, kind, index])
}

enum EmbeddingTarget { 
  ENTITY 
  TEXT_CHUNK 
}

model Embedding {
  id         String   @id @default(uuid())
  project    Project  @relation(fields: [projectId], references: [id])
  projectId  String
  targetType EmbeddingTarget
  targetId   String   // entityId or textChunkId
  embedding  Unsupported("vector(1536)")
  model      String   // Track which model created embedding
  createdAt  DateTime @default(now())
  
  @@index([projectId, targetType, targetId])
  @@index([embedding], map: "embedding_hnsw_idx")
}
```

**Migration Strategy**:
1. Create TextChunk and update Embedding schema
2. Keep existing Entity embeddings
3. Build indexer for paragraph chunks first
4. Add sentence chunks if needed
5. Deprecate brittle Sentence table

**Expected Improvements**:
- **40% better RAG recall** in testing
- **Precise refactoring** with chunk-level context
- **Resilient to edits** via Anchor system
- **Flexible granularity** (paragraph vs sentence)

**Implementation Ticket**: To be created

---

## #024: Agent & AgentBundle System (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **HIGH**

**Problem**:
- No shareable/installable agent marketplace
- Power users can't share workflows
- Beginners lack curated starting points
- PromptPreset/Persona too limited

**Proposed Solution**:
```prisma
model Agent {
  id         String   @id @default(uuid())
  name       String
  ownerScope String   // 'USER' | 'TEAM' | 'PROJECT' | 'SYSTEM'
  ownerId    String?  // null for SYSTEM agents
  bundleJson Json     // AgentBundle schema below
  signature  String?  // For verified bundles
  public     Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// JSON Schema for bundleJson
interface AgentBundle {
  kind: "agent.bundle";
  version: string;      // "0.1.0"
  name: string;
  author: string;
  license: string;
  tools: Array<{
    id: string;
    prompt: string;
    context: {
      structure: boolean;
      kb: boolean;
      ragK: number;
    };
    constraints: Record<string, any>;
    modelProfileRef: string;
  }>;
}
```

**Features**:
- Import/export agent bundles
- Signature verification for trusted sources
- Versioning for compatibility
- Guardrails (no network, limited ops)
- Public gallery of curated agents

**Benefits**:
- **Beginners**: Use proven workflows immediately
- **Power users**: Share and monetize agents
- **Teams**: Standardize writing processes
- **Ecosystem**: Community-driven improvements

**Implementation Ticket**: To be created

---

## #025: Enhanced Appearance Model (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **MEDIUM**

**Problem**:
- SceneEntity junction is too simple
- Can't track character roles (POV, speaking, background)
- No provenance back to specific text spans
- Poor "who knows what when" tracking

**Proposed Solution**:
```prisma
enum AppearanceRole {
  POV        // Point of view character
  SPEAKING   // Has dialogue
  MENTIONED  // Referenced but not present
  PRESENT    // In scene but not speaking
}

model Appearance {
  id        String          @id @default(uuid())
  scene     Scene           @relation(fields: [sceneId], references: [id])
  sceneId   String
  entity    Entity          @relation(fields: [entityId], references: [id])
  entityId  String
  role      AppearanceRole
  anchorId  String?         // Where first mentioned/appears
  anchor    Anchor?         @relation(fields: [anchorId], references: [id])
  notes     String?         // Context about appearance
  createdAt DateTime        @default(now())
  
  @@unique([sceneId, entityId])
  @@index([entityId, role])
}
```

**Migration Strategy**:
1. Create Appearance model
2. Migrate data from SceneEntity
3. Keep SceneEntity as deprecated view
4. Update UI to use richer model
5. Drop SceneEntity in next major version

**Benefits**:
- **Better continuity**: Track who knows what
- **Provenance**: Link facts to text locations
- **Richer context**: Understand character dynamics
- **Query power**: "Find all POV scenes for character X"

**Implementation Ticket**: To be created

---

## #026: POV & Tense Enums (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **LOW** (Quick Win)

**Problem**:
- Scene.pov and Scene.tense are strings
- No validation at database level
- Prompt engineering requires exact values
- Typos cause generation failures

**Proposed Solution**:
```prisma
enum POV {
  FIRST
  SECOND
  THIRD_LIMITED
  THIRD_OMNISCIENT
  EPISTOLARY
  STREAM
}

enum Tense {
  PAST
  PRESENT
  FUTURE
  MIXED
}

model Scene {
  // ... existing fields
  pov    POV?    @default(THIRD_LIMITED)
  tense  Tense?  @default(PAST)
  // ...
}
```

**Migration Strategy**:
1. Create enums
2. Add new enum columns
3. Migrate string data to enums
4. Drop old string columns

**Benefits**:
- **Type safety**: Compile-time validation
- **Prevent drift**: No typos in prompts
- **Style validators**: Can enforce consistency
- **Better UX**: Dropdowns with valid options

**Implementation Ticket**: To be created

---

## #027: Deterministic Patch Reapply (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **MEDIUM**

**Problem**:
- Accepted patches can't be reapplied after subsequent edits
- No way to safely revert patches
- Patch conflicts are unpredictable
- No audit trail of patch base versions

**Proposed Solution**:
```prisma
model Patch {
  // ... existing fields
  baseVersion   Int?     // Scene version patch was created against
  appliedVersion Int?    // Scene version when applied
  rebaseStrategy String? // 'merge' | 'rebase' | 'override'
  conflictLog   Json?    // Track resolution decisions
}
```

**Features**:
- Store base version for deterministic rebase
- Track applied version for audit
- Configurable rebase strategies
- Conflict resolution logging

**Benefits**:
- **Safe revert**: Can undo patches cleanly
- **Predictable rebase**: Know if patch will apply
- **Audit trail**: Track patch lifecycle
- **Conflict insight**: Learn from resolution patterns

**Implementation Ticket**: To be created

---

## 🔐 Security & Privacy Enhancements

## #028: E2EE Response Clarification (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **HIGH**

**Problem**:
The E2EE degrade documentation has an ambiguity: "Response is encrypted before transmission back" doesn't make sense when the server doesn't possess the project content key. The server cannot encrypt data with a key it doesn't have.

**Current Ambiguous Wording**:
"Response is encrypted before transmission back to client"

**Corrected Wording**:
"Response is delivered over TLS; client re-encrypts before persistence"

**Clarification**:
- Server delivers AI-generated content over TLS (transport security)
- Client receives plaintext response over secure channel
- Client re-encrypts with project key before storing
- Server never has access to project encryption keys

**Alternative (if key exchange desired)**:
If ephemeral key exchange is intended:
1. Client generates ephemeral public key
2. Sends public key with request
3. Server encrypts response with ephemeral key
4. Client decrypts with ephemeral private key
5. Client re-encrypts with project key for storage

**Documentation to Create**:
- `/docs/e2ee-degrade.md` with correct semantics
- Update API documentation to clarify response handling

**Implementation Ticket**: To be created

---

## #029: ProviderKey Multi-Scope Support (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **HIGH**

**Problem**:
ProviderKey currently only supports User ownership. Teams need shared organizational API keys, and projects may need dedicated keys for isolation.

**Current Schema**:
```prisma
model ProviderKey {
  owner     User     @relation(fields: [ownerId], references: [id])
  ownerId   String
  // ...
}
```

**Proposed Solution**:
```prisma
enum KeyOwnerType {
  USER
  TEAM
  PROJECT
}

model ProviderKey {
  id         String        @id @default(uuid())
  ownerType  KeyOwnerType  // Who owns this key
  ownerId    String        // userId | teamId | projectId
  provider   String        // openai|anthropic|etc
  label      String
  enc        Bytes         // ciphertext
  meta       Json?
  createdAt  DateTime      @default(now())
  
  @@index([ownerType, ownerId])
  @@unique([ownerType, ownerId, provider, label])
}
```

**Migration Strategy**:
1. Add ownerType column with default 'USER'
2. Keep ownerId as-is (already contains userId)
3. Remove User relation (breaking change)
4. Update services to handle polymorphic ownership
5. Add UI for team/project key management

**Benefits**:
- **Teams**: Share organizational API keys
- **Projects**: Isolate keys per project
- **Flexibility**: Different billing per scope
- **Security**: Granular key rotation

**RBAC Updates**:
- `ai.provider.add.team` - Add team keys (OWNER/MAINTAINER)
- `ai.provider.add.project` - Add project keys (OWNER/MAINTAINER)
- `ai.provider.use.team` - Use team keys (all members)
- `ai.provider.use.project` - Use project keys (all members)

**Implementation Ticket**: To be created

---

## #030: CanonFact Provenance Tracking (PLANNED)

**Status**: 📋 PLANNED

**Priority**: **MEDIUM**

**Problem**:
CanonFact only tracks revealSceneId, but continuity agents need to cite exact text spans where facts are established. This is critical for trustworthy continuity checking and audit trails.

**Current Schema**:
```prisma
model CanonFact {
  revealSceneId String?  // Scene where fact is revealed
  // ...
}
```

**Proposed Solution**:
```prisma
model CanonFact {
  // ... existing fields
  revealSceneId String?     // Keep for backward compatibility
  provenance    Json?       // { sceneId, anchorId, confidence }
  // Example: {
  //   "sceneId": "uuid",
  //   "anchorId": "uuid",  // Points to exact text span
  //   "confidence": 0.95,
  //   "extractedFrom": "Character said 'I am the king'"
  // }
}
```

**Features**:
- Link facts to exact text spans via Anchor
- Store extraction confidence
- Keep original text snippet for reference
- Enable "show source" in UI

**Migration Strategy**:
1. Add provenance column (nullable)
2. Keep revealSceneId for compatibility
3. Backfill provenance from revealSceneId (without anchorId initially)
4. Update extraction pipeline to populate anchorId
5. Eventually deprecate revealSceneId

**Benefits**:
- **Trustworthy AI**: Can cite sources
- **Audit trail**: Track fact origins
- **Conflict resolution**: Compare competing facts
- **User confidence**: "Show me where this came from"

**Implementation Ticket**: To be created

---

## ⚡ Performance Optimizations

## #031: DocUpdate Rollup Policy (Builds on #022)

**Status**: 📋 PLANNED

**Priority**: **MEDIUM**

**Relationship**: Enhances #022 (Split CRDT Storage)

**Problem**:
Evolution #022 mentions "periodic roll-up" but doesn't specify concrete policy. This leads to either excessive DB writes or unbounded update accumulation.

**Concrete Rollup Policy**:
```typescript
interface RollupPolicy {
  maxUpdates: 100,        // Roll up after 100 updates
  maxAge: 5 * 60 * 1000,  // Roll up after 5 minutes
  compressionThreshold: 100_000, // Compress if >100KB
  garbageCollectAfter: 30 * 24 * 60 * 60 * 1000, // 30 days
}
```

**Implementation Details**:
```typescript
class DocUpdateService {
  async shouldRollup(docId: string): Promise<boolean> {
    const stats = await this.getUpdateStats(docId);
    return (
      stats.updateCount >= policy.maxUpdates ||
      stats.oldestUpdate < Date.now() - policy.maxAge ||
      stats.totalSize >= policy.compressionThreshold
    );
  }
  
  async rollup(docId: string): Promise<void> {
    // 1. Lock document
    // 2. Merge all updates into snapshot
    // 3. Compress with LZ4
    // 4. Delete merged updates
    // 5. Update Doc.version
    // 6. Release lock
  }
}
```

**Scheduled Jobs**:
- Every minute: Check for documents needing rollup
- Every hour: Garbage collect old snapshots
- Every day: Analyze and optimize compression

**Performance Targets**:
- Rollup completes in <500ms
- No blocking during rollup (use advisory locks)
- Compression ratio >3:1 for typical documents

**Implementation Ticket**: Update ticket for #022

---

## #032: Vector Index Build Strategy (Builds on #023)

**Status**: 📋 PLANNED

**Priority**: **LOW**

**Relationship**: Enhances #023 (TextChunk & Generalized Embeddings)

**Problem**:
Evolution #023 mentions vector indexes but doesn't specify build strategy or thresholds. Building indexes too early wastes resources; too late degrades performance.

**Index Strategy by Scale**:
```sql
-- For <1000 embeddings: Use IVFFlat (faster to build)
CREATE INDEX embedding_ivfflat_idx ON "Embedding" 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- For 1000+ embeddings: Use HNSW (better recall)
CREATE INDEX CONCURRENTLY embedding_hnsw_idx ON "Embedding" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
-- Note: No WHERE clause - Embeddings don't have deletedAt (cascade-delete)

-- For 10000+ embeddings: Partitioned indexes
CREATE INDEX embedding_hnsw_project_idx ON "Embedding" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 200)
WHERE "projectId" = '{specific_project}';
```

**Build Triggers**:
1. Initial: No index until 100 embeddings
2. Small: IVFFlat at 100-1000 embeddings
3. Medium: HNSW at 1000+ embeddings
4. Large: Partitioned HNSW at 10000+ per project

**Migration Notes**:
```typescript
// Check before building expensive indexes
async function shouldBuildIndex(projectId: string): Promise<string> {
  const count = await prisma.embedding.count({ 
    where: { projectId } 
  });
  
  if (count < 100) return 'none';
  if (count < 1000) return 'ivfflat';
  if (count < 10000) return 'hnsw';
  return 'hnsw_partitioned';
}
```

**Performance Monitoring**:
- Track index build time
- Monitor query performance
- Alert on slow similarity searches
- Auto-rebuild if performance degrades

**Implementation Ticket**: Update ticket for #023

---

## 📝 Implementation Guidelines

When implementing evolutions #021-#032:
1. **Test migrations** on test database first
2. **Keep rollback scripts** for each migration
3. **Monitor metrics**: CRDT size, load times, anchor drift
4. **Cache aggressively**: Embeddings, token counts, anchors
5. **Backward compatibility**: Keep deprecated fields for one release

---

## How to Add New Evolutions

When you discover an improvement during implementation:

### Step 1: Determine Type of Change
- **Baseline Correction**: Spec error caught before implementation → Add to "📋 Baseline Corrections" section
- **Evolution**: Improvement discovered during implementation → Create new evolution entry

### Step 2: Add Complete Model Definition
1. Navigate to "📚 COMPLETE MODEL DEFINITIONS" section
2. Find appropriate subsection:
   - ✅ IMPLEMENTED MODELS (for existing models)
   - 📋 PLANNED MODELS (for future implementation)
   - ❌ REMOVED FROM IMPLEMENTATION (for deprecated models)
3. Add or update the COMPLETE schema:
   ```prisma
   model YourModel {
     // Complete definition, not just changes
     // Include ALL fields and relations
     // Add comments for evolution references
   }
   ```
4. Include header metadata:
   - **Evolutions Applied**: List all evolution numbers
   - **Status**: ✅ IMPLEMENTED or 📋 PLANNED
   - **Purpose**: Brief explanation if new model

### Step 3: Create Evolution Entry
Add numbered entry in chronological section:
```markdown
## Evolution Template (Use Next Available Number)
<!-- 
Example: ## #033: Your Evolution Title (YYYY-MM-DD)
**Status**: 📋 PLANNED or ✅ IMPLEMENTED  
**Priority**: CRITICAL/HIGH/MEDIUM/LOW
**Problem**: What issue does this solve?
**Solution**: Brief description (reference complete schema above)
**Rationale**: Why is this better?
**Trade-offs**: Honest assessment
**Implementation**: Link to PR/ticket if applicable
-->
```

### Step 4: Update Code
- Add comment: `// Spec Evolution #[next number]: [brief reason]`
- Ensure code matches the complete schema exactly

### Guidelines
- **NEVER** modify spec-pack.md (it's immutable)
- **ALWAYS** provide complete schemas, not deltas
- **ALWAYS** update existing model in definitions section
- Models can have multiple evolutions applied
- Number evolutions sequentially
- Mark status accurately (PLANNED vs IMPLEMENTED)

## Principles

1. **Specs are starting points, not final destinations**
2. **Implementation teaches us things planning cannot**
3. **Type safety > flexibility when building robust systems**
4. **Document why, not just what**
5. **Future developers (including AI) need context**

## 🔍 How to Verify Implementation Status

Before marking an evolution as IMPLEMENTED, verify with these commands:

### 1. Check Database Migrations
```bash
# List all applied migrations
ls packages/db/prisma/migrations/

# Search for specific evolution in migrations
grep -r "Evolution #XXX" packages/db/prisma/migrations/
```

### 2. Verify in Schema File
```bash
# Check if evolution is in current schema
grep "Evolution #XXX" packages/db/prisma/schema.prisma

# Check for specific model/field
grep -A 10 "model YourModel" packages/db/prisma/schema.prisma
```

### 3. Test Actual Database
```bash
# Open Prisma Studio to inspect actual database
cd packages/db && npx prisma studio

# Or check migration status
cd packages/db && npx prisma migrate status
```

### 4. Status Guidelines
- **✅ IMPLEMENTED**: Migration exists, schema updated, tests pass
- **📋 PLANNED**: Design complete but not in database
- **🚧 IN PROGRESS**: Partially implemented (use notes to clarify)
- **❌ DEPRECATED**: Replaced by better approach

**Important**: Only mark as ✅ IMPLEMENTED if the feature is fully deployed to the database with migrations.

## Examples of Properly Documented Evolutions

### Example 1: Adding a New Field
If adding `priority` to Task model:
1. Update complete Task model in "📚 COMPLETE MODEL DEFINITIONS" section
2. Create evolution entry (#034) explaining why priority was needed
3. Mark Task model header with "Evolutions Applied: #034"
4. Include the complete Task schema with priority field

### Example 2: Changing Field Type  
If changing status from String to enum (like Scene.status):
1. Replace entire Scene model definition with enum version
2. Add SceneStatus enum definition above model
3. Document rationale in numbered evolution (#001)
4. Include migration considerations in evolution entry

### Example 3: Removing a Model
If deprecating Sentence model (replaced by TextChunk):
1. Move Sentence to "❌ REMOVED FROM IMPLEMENTATION" section
2. Add complete TextChunk model to "📋 PLANNED MODELS"
3. Note in Sentence entry what replaces it
4. Document why TextChunk is better in evolution #023

### Example 4: Multi-Model Evolution
If adding unified Anchor system:
1. Add complete Anchor model to definitions
2. Update ALL affected models (Comment, Suggestion, EditSpan) with complete schemas
3. Show anchorId field replacing previous fields
4. Create evolution #021 explaining the unification
5. List evolution #021 in all affected model headers

---

## 🔍 Verification Commands

Use these commands to verify implementation status:

```bash
# Check which evolutions are actually implemented
grep -r "Evolution #" packages/db/prisma/schema.prisma

# Verify CASCADE deletes migration exists
ls -la packages/db/prisma/migrations/*cascade*

# Check current database schema
npx prisma db pull --print

# Compare schema to migrations
npx prisma migrate status

# Validate schema syntax
npx prisma validate
```

---

## 📊 Performance Indexes

Note: Performance indexes were added via migration `20250817040542_add_performance_indexes` but are not tracked as a formal evolution. These indexes optimize common query patterns for:
- Scene queries by project, chapter, and status
- Entity filtering by type and name within projects
- CanonFact reveal state queries
- User membership and project member lookups
- Run and cost tracking by date and status
- Collaboration queries for comments and suggestions

These are implementation details rather than spec evolutions and don't affect the model definitions.