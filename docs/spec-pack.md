# {APP_NAME} Spec Pack

## 0. Project Guardrails
- **Auth & Tenancy:** Email+pass or OAuth; multi-tenant with **User**, **Team**, **Membership**; **ProjectMember** roles: `OWNER|MAINTAINER|WRITER|READER`.
- **Key Management (BYOK):** Encrypted **ProviderKey** records per user/team. Envelope encryption with per-user keyring; server never logs secrets. Keys label which endpoints/models are allowed.
- **Encryption:** 
  - At rest: DB + object storage encryption.
  - Optional **E2EE for manuscript**: per-project content key (XChaCha20-Poly1305). CRDT updates encrypted over WS; server relays opaque blobs.
  - Cloud features that can't work with E2EE (server-side AI) must degrade gracefully (user warned).
- **Privacy:** No training on user text. Local-only mode (Ollama/LM Studio) supported. Transparent run logs downloadable.
- **Internationalization & Accessibility:** i18n-ready copy; WCAG 2.2 AA target; all actions keyboard-accessible; prefers-reduced-motion honored.
- **Performance budgets:** 
  - Local edit ≤ 75ms P95 
  - Collab echo ≤ 300ms median 
  - Context build ≤ 1s for 100k tokens with streaming.
- **License:** Recommend MPL-2.0 for file-level copyleft that encourages plugin ecosystem while allowing proprietary extensions. Apache-2.0 lacks copyleft; AGPL-3.0 enforces networked source distribution, which may deter commercial contributors. MPL-2.0 balances openness and adoption.
- **Tech Stack:**
  - Web: TypeScript + Next.js
  - API: Node.js + Fastify (WebSocket support)
  - Database: PostgreSQL with pgvector; Redis for ephemeral state
  - Editor: TipTap (ProseMirror) with Markdown I/O
  - Realtime: Yjs CRDTs
  - Offline: Service Worker + IndexedDB (Dexie)
  - Desktop: Tauri (Rust core); Electron notes if Node APIs required
  - AI Adapters: pluggable providers (OpenRouter, OpenAI, Anthropic, Google, Mistral, local via LM Studio/Ollama)
  - Security: optional E2E encryption, secrets vault, role-based access
  - **Observability:** structured logs for AI runs; diff metrics (#spans changed, net words Δ); traces for AI calls, privacy-safe metrics; feature flags via config/remote.
  - **Document format:** Each Scene stores **Markdown** (canonical) and a **CRDT doc** (ProseMirror/Yjs). Diffs are produced against Markdown and applied as CRDT patches.
  - Testing: Vitest + Playwright; property tests for CRDT and context redaction.

## 1. Problem Statement & Deltas
| Pain Point | Remedy |
| --- | --- |
| Online-only tools | Full PWA + desktop packaging; CRDT sync | 
| Poor real-time collaboration | Low-latency multi-cursor editing with Yjs | 
| Lack mass refactors | Global rename pipelines with preview & tests |
| Story bible leaks/contradictions | Canon DB with reveal gates; Context Builder respects spoilers |
| Prompt overhead | Opinionated workflows and prompt presets | 
| Limited editor/exports | Manuscript editor with snapshots, track changes, lossless exports |
| Opaque model costs | Live token/cost meter with budgets |

## 2. Target Users & Top Tasks
| Segment | Top Tasks | Success Criteria | Moments-that-matter |
| --- | --- | --- | --- |
| Discovery writers | Free-form drafting, surprise twists, avoid spoilers | 1k words/session, spoiler-free hints | When inspiration strikes offline |
| Plotters | Outline arcs, enforce canon, global refactors | Consistent facts, rename success | Adding twist without leaks |
| Serial fiction authors | Draft episodes, track reveals, manage budgets | On-time releases, cost caps | Live editing with editor | 
| Editors/Betas | Comment, suggest edits, ensure continuity | low friction, no leak | Reviewing reveals |

## 3. Scope & Success Metrics
**MVP (90 days):** Projects/Books/Chapters/Scenes, Codex, Canon DB + Context Builder, Write/Rewrite/Describe, mass find/replace, offline PWA, real-time collab, model adapters, export, cost meter.

**North-star metrics:** time-to-first-1k-words, % offline sessions, collaborative sessions per project, contradiction/spoiler lint count, cost per 10k generated words.

**Milestone after MVP (v0.2):** **AI Refactor Chat (global)**—LLM-driven refactors across chapter/book/project with preview & batch apply. **MVP includes Scene-level Chat‑to‑Edit**.

## 4. Functional Requirements
### User Stories & Gherkin
#### Spoiler-safe Context
```
Feature: Spoiler-safe context composition
  Scenario: Hidden plot twist is not leaked to AI
    Given a Character "A" has secret "is_villain" with reveal_at Scene-45
    And I compose context for Scene-20
    When I click "Write with AI"
    Then the context sent to the model MUST NOT include "is_villain"
    And the Context Builder UI highlights redacted facts
```

#### Global Rename
```
Feature: Project-wide rename
  Scenario: Rename character everywhere
    Given Character "Bob" exists in 3 scenes
    When I rename "Bob" to "Robert"
    Then all scenes show "Robert" and a diff preview is available
```

#### Offline Authoring
```
Feature: Offline authoring with sync
  Scenario: Write offline and sync later
    Given I lose connection while editing Scene-5
    When connection restores
    Then my edits sync without conflicts via CRDT
```

#### Realtime Co-edit
```
Feature: Realtime co-edit with presence
  Scenario: Two authors edit same scene
    Given Alice and Bob open Scene-1
    When Alice types
    Then Bob sees characters within 300ms and Alice's cursor
```

#### Cost Guardrail
```
Feature: Budget cap
  Scenario: Generation blocked when over budget
    Given project budget is $10
    And spent $10
    When I request another generation
    Then generation is blocked and UI shows budget reached
```

### Chat‑to‑Edit (Scene) — MVP
```
Feature: Chat-driven scene edit with diff preview

Scenario: Ask AI to revise a single scene and review changes

Given I open Scene-5

And I open the "Refactor Chat" panel

When I say "Tighten pacing in the chase paragraph; keep voice and POV"

Then the system returns a patch proposal with a side-by-side diff

And I can accept or reject each hunk

And upon apply, the scene updates via CRDT without losing collaborators' edits

And a snapshot and Run log are recorded
```

### Semantic Refactor Chat (Chapter/Book/Project) — v0.2
```
Feature: Global semantic refactor with targeted scope

Scenario: Add a vocal tic to Character "Jae" across the book

Given a Character "Jae" exists with aliases ["J."]

And I select scope = "Book-1"

When I say "Give Jae a subtle stutter on words starting with 's' in dialogue"

Then the system finds candidate dialogue spans attributed to Jae with confidence scores

And proposes patches grouped by Scene with a batch preview (showing #changes per scene)

And the Canon DB is updated with a trait note "speech_pattern: subtle stutter (s-words)"

And spoiler/redaction rules remain enforced

When I apply the batch

Then only accepted hunks are committed; a refactor record links all patches
```

### Example: Setting Change — v0.2
```
Feature: Change setting from "dockyard" to "desert checkpoint" in Chapter-3

Scenario: Contextual rewrite of descriptions

Given I select scope = "Chapter-3"

When I say "Change the setting from a foggy dockyard at night to a dusty desert checkpoint at noon"

Then the system identifies descriptive spans and dependent metaphors

And generates replacements consistent with style guidelines

And returns a diff preview with per-span confidence and rationale
```

#### Local vs Cloud Model
```
Feature: Local model selection
  Scenario: Choose Ollama locally
    Given Ollama is running
    When I select "Ollama" for Rewrite
    Then generation uses local model and cost $0
```

#### Export Round‑trip
```
Feature: Lossless export/import

Scenario: Export to Markdown+YAML and re-import

Given a Book with 2 Chapters and 5 Scenes with comments and suggestions

When I export to a zip (Markdown + YAML front-matter + assets)

And I re-import the zip

Then structure, metadata, comments, and suggestions are preserved
```

#### Conflict Resolution (CRDT)
```
Feature: Conflict-free merges

Scenario: Simultaneous offline edits

Given Alice and Bob both edit Scene-12 offline

When both reconnect

Then the merged scene contains both sets of non-overlapping edits

And overlapping ranges are resolved per CRDT order with no data loss
```

#### Reveal Gate Override (Author-only)
```
Feature: Temporary reveal for author tools

Scenario: Use hidden facts in "Outline" but not in "Write"

Given Character "Eve" has secret "double_agent" revealed at Scene-30

When I run the Outline workflow with "Include spoilers for author tools"

Then the context includes "double_agent"

And when I run "Write with AI" for Scene-10

Then the context excludes "double_agent"
```

#### Global Rename with Aliases
```
Feature: Rename across codex and prose with review

Scenario: Replace character name and aliases

Given "Bob" has alias "Bobby"

When I rename "Bob" to "Robert" with "convert aliases"

Then all occurrences of "Bob" and "Bobby" are changed to "Robert"

And a review diff is presented before apply
```

5. Non-Functional Requirements

Performance: <75ms local edits, <300ms collab echo, context assembly <1s for 100k tokens.

Reliability: autosave locally, CRDT merges, crash-safe rehydration.

Security: no server-side training, BYOK, encrypted storage, least-privilege, transparent logs.

Accessibility: keyboard-first, screen reader semantic tags, dyslexia-friendly fonts.

6. Domain Model & Schema
ERD
Project → Book → Chapter → Scene
Entities: Character, Location, Item, Organization (Entity table)
CanonFact linked to Entity
PromptPreset, Persona, ModelProfile
ContextRule
CollabSession, Comment, Suggestion
CostEvent
Refactor, Patch, Hunk, EditSpan, Run
Snapshot, Sentence, StyleGuide
User, Team, Membership, ProjectMember
ProviderKey, Budget, SceneEntity (join), Embedding (pgvector)

Notes:
- Refactor groups a user instruction, scope, and a set of Patch proposals.
- Patch captures the diff in two formats: a unified diff over Markdown and a CRDT update blob for precise application.
- Hunk represents a sub-diff within a Patch for granular review.
- EditSpan provides robust anchoring via Yjs RelativePositions and text anchors for fallback.

### Prisma Schema (excerpt)
```prisma
enum Role { OWNER MAINTAINER WRITER READER }
enum RevealState { PLANNED REVEALED REDACTED_UNTIL_SCENE REDACTED_UNTIL_DATE }
enum SuggestionStatus { OPEN APPLIED DISMISSED }
enum RefactorStatus { DRAFT PREVIEW APPLIED PARTIAL DISCARDED }
enum PatchStatus { PROPOSED ACCEPTED REJECTED APPLIED FAILED }
enum HunkStatus { PROPOSED ACCEPTED REJECTED APPLIED FAILED }
enum ScopeType { SCENE CHAPTER BOOK PROJECT CUSTOM }

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  displayName  String?
  createdAt    DateTime @default(now())
  memberships  Membership[]
  projectRoles ProjectMember[]
  providerKeys ProviderKey[]
  settings     Json?
}

model Project {
  id        String @id @default(uuid())
  name      String
  slug      String  @unique
  books     Book[]
  members   ProjectMember[]
  budgets   Budget[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Book {
  id        String @id @default(uuid())
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  chapters  Chapter[]
  title     String
  index     Int
}

model Chapter {
  id       String @id @default(uuid())
  book     Book   @relation(fields: [bookId], references: [id])
  bookId   String
  scenes   Scene[]
  title    String
  index    Int
}

model Scene {
  id        String @id @default(uuid())
  chapter   Chapter @relation(fields: [chapterId], references: [id])
  chapterId String
  title     String
  index     Int
  status    String      // draft|revised|final
  pov       String?
  tense     String?
  contentMd String      // canonical Markdown
  docCrdt   Json        // Yjs/Automerge encoded document
  version   Int         @default(1)
  summary   String?
  wordCount Int         @default(0)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  snapshots Snapshot[]
  sentences Sentence[]
  entities  SceneEntity[]
  runs      Run[]
}

model Snapshot {
  id        String @id @default(uuid())
  scene     Scene  @relation(fields: [sceneId], references: [id])
  sceneId   String
  version   Int
  contentMd String
  createdAt DateTime @default(now())
}

model Sentence {
  id        String @id @default(uuid())
  scene     Scene  @relation(fields: [sceneId], references: [id])
  sceneId   String
  index     Int
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model StyleGuide {
  id        String @id @default(uuid())
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  name      String
  rules     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Entity {
  id       String @id @default(uuid())
  type     String
  name     String
  aliases  String[]
  traits   String[]
  facts    CanonFact[]
  embeddings Embedding[]
}

model CanonFact {
  id          String @id @default(uuid())
  entity      Entity @relation(fields: [entityId], references: [id])
  entityId    String
  fact        String
  revealState RevealState
  revealSceneId String?
  revealAt    DateTime?
  confidence  Int      @default(100)
}

model PromptPreset {
  id   String @id @default(uuid())
  name String
  text String
}

model Persona {
  id   String @id @default(uuid())
  name String
  style String
}

model ModelProfile {
  id       String @id @default(uuid())
  name     String
  provider String
  config   Json
}

model ContextRule {
  id      String @id @default(uuid())
  include String[]
  exclude String[]
  maxTokens Int
  project   Project? @relation(fields: [projectId], references: [id])
  projectId String?
}

model CollabSession {
  id      String @id @default(uuid())
  sceneId String
  users   String[]
  createdAt DateTime @default(now())
}

model Comment {
  id      String @id @default(uuid())
  sceneId String
  author  String
  text    String
  range   Json?
  createdAt DateTime @default(now())
}

model Suggestion {
  id      String @id @default(uuid())
  sceneId String
  author  String
  text    String
  status  SuggestionStatus @default(OPEN)
  range   Json?
  createdAt DateTime @default(now())
}

model CostEvent {
  id        String @id @default(uuid())
  provider  String
  tokensIn  Int
  tokensOut Int
  amount    Decimal @db.Decimal(10,4)
  createdAt DateTime @default(now())
  run       Run?     @relation(fields: [runId], references: [id])
  runId     String?
}

model Refactor {
  id          String         @id @default(uuid())
  project     Project        @relation(fields: [projectId], references: [id])
  projectId   String
  scopeType   ScopeType
  scopeId     String?        // sceneId|chapterId|bookId for targeted scopes
  instruction String         // user's natural-language request
  plan        Json?          // interpreter output: entities, operations, constraints
  status      RefactorStatus @default(DRAFT)
  createdBy   String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  patches     Patch[]
  metrics     Json?          // counts, confidence distribution
}

model Patch {
  id          String     @id @default(uuid())
  refactor    Refactor   @relation(fields: [refactorId], references: [id])
  refactorId  String
  scene       Scene      @relation(fields: [sceneId], references: [id])
  sceneId     String
  status      PatchStatus @default(PROPOSED)
  // A concise, human-readable summary ("Add vocal tic to 3 lines of dialogue")
  summary     String
  // Unified diff (before/after) for preview UI
  unifiedDiff String
  // Yjs/ProseMirror delta for precise apply (base64-encoded update)
  crdtUpdate  Bytes?
  // Confidence 0-100 and optional rationale
  confidence  Int         @default(80)
  rationale   String?
  createdAt   DateTime    @default(now())
  appliedAt   DateTime?
  hunks       Hunk[]
}

model EditSpan {
  id          String   @id @default(uuid())
  hunk        Hunk     @relation(fields: [hunkId], references: [id])
  hunkId      String
  // Robust anchoring
  yjsAnchor   Json?    // RelativePosition payload
  textAnchor  Json?    // { beforeKGramHash, afterKGramHash, approxOffset }
  startChar   Int?
  endChar     Int?
}

model Hunk {
  id          String     @id @default(uuid())
  patch       Patch      @relation(fields: [patchId], references: [id])
  patchId     String
  status      HunkStatus @default(PROPOSED)
  summary     String
  unifiedDiff String
  crdtUpdate  Bytes?
  confidence  Int        @default(80)
  rationale   String?
  createdAt   DateTime   @default(now())
  appliedAt   DateTime?
  editSpans   EditSpan[]
}

model Run {
  id         String   @id @default(uuid())
  project    Project  @relation(fields: [projectId], references: [id])
  projectId  String
  scene      Scene?   @relation(fields: [sceneId], references: [id])
  sceneId    String?
  provider   String
  model      String
  action     String   // WRITE|REWRITE|DESCRIBE|EMBED|MODERATE
  promptObj  Json     // the constructed prompt object
  inputTokens  Int
  outputTokens Int
  costUSD    Decimal  @db.Decimal(10,4)
  createdAt  DateTime @default(now())
}

model Embedding {
  id        String   @id @default(uuid())
  entity    Entity   @relation(fields: [entityId], references: [id])
  entityId  String
  // Prisma doesn't yet have native vector type; use Unsupported to map pgvector
  embedding Unsupported("vector(1536)")
  createdAt DateTime @default(now())
  @@index([embedding], map: "embedding_ivfflat") // create with raw SQL migration for ivfflat
}

model SceneEntity {
  scene   Scene  @relation(fields: [sceneId], references: [id])
  sceneId String
  entity  Entity @relation(fields: [entityId], references: [id])
  entityId String
  @@id([sceneId, entityId])
}

model Team {
  id        String @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  members   Membership[]
}

model Membership {
  id      String @id @default(uuid())
  user    User   @relation(fields: [userId], references: [id])
  userId  String
  team    Team   @relation(fields: [teamId], references: [id])
  teamId  String
  role    Role   @default(WRITER)
}

model ProjectMember {
  id        String @id @default(uuid())
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  user      User    @relation(fields: [userId], references: [id])
  userId    String
  role      Role    @default(WRITER)
  @@unique([projectId, userId])
}

model ProviderKey {
  id        String @id @default(uuid())
  owner     User   @relation(fields: [ownerId], references: [id])
  ownerId   String
  provider  String   // openai|anthropic|openrouter|mistral|ollama|lmstudio
  label     String
  enc       Bytes    // ciphertext (envelope encryption)
  meta      Json?
  createdAt DateTime @default(now())
}

model Budget {
  id         String   @id @default(uuid())
  project    Project  @relation(fields: [projectId], references: [id])
  projectId  String
  limitUSD   Decimal  @db.Decimal(10,2)
  spentUSD   Decimal  @db.Decimal(10,2) @default(0)
  resetsAt   DateTime?
}
```

7. API & Events

### OpenAPI 3.1 (excerpt – key endpoints & schemas)
```yaml
openapi: 3.1.0
info:
  title: {APP_NAME} API
  version: 0.1.0
components:
  schemas:
    ID: { type: string, format: uuid }
    Role: { type: string, enum: [OWNER, MAINTAINER, WRITER, READER] }
    RevealState: { type: string, enum: [PLANNED, REVEALED, REDACTED_UNTIL_SCENE, REDACTED_UNTIL_DATE] }
    Scene:
      type: object
      required: [id, chapterId, title, index, contentMd]
      properties:
        id: { $ref: '#/components/schemas/ID' }
        chapterId: { $ref: '#/components/schemas/ID' }
        title: { type: string }
        index: { type: integer }
        status: { type: string }
        pov: { type: string }
        tense: { type: string }
        contentMd: { type: string }
        docCrdt: { type: object }
    ComposeContextRequest:
      type: object
      required: [sceneId]
      properties:
        sceneId: { $ref: '#/components/schemas/ID' }
        windowScenes: { type: integer, default: 3 }
        includeSpoilersForAuthorTools: { type: boolean, default: false }
        maxTokens: { type: integer, default: 2000 }
        rules: { type: object }
    ComposeContextResponse:
      type: object
      properties:
        promptObject: { type: object }
        redactions:
          type: array
          items: { type: object, properties: { factId: { $ref: '#/components/schemas/ID' }, reason: { type: string } } }
        tokenEstimate: { type: integer }
    GenerateRequest:
      type: object
      required: [sceneId, action, modelProfileId]
      properties:
        sceneId: { $ref: '#/components/schemas/ID' }
        action: { type: string, enum: [WRITE, REWRITE, DESCRIBE] }
        modelProfileId: { $ref: '#/components/schemas/ID' }
        stream: { type: boolean, default: true }
        promptOverride: { type: object }
    RenamePreviewRequest:
      type: object
      required: [projectId, from, to]
      properties:
        projectId: { $ref: '#/components/schemas/ID' }
        from: { type: string }
        to:   { type: string }
        includeAliases: { type: boolean, default: true }
    RenamePreviewResponse:
      type: object
      properties:
        changes: { type: array, items: { type: object, properties: { sceneId: { $ref: '#/components/schemas/ID' }, before: { type: string }, after: { type: string } } } }
    PatchProposal:
      type: object
      required: [id, sceneId, summary, hunks]
      properties:
        id: { $ref: '#/components/schemas/ID' }
        sceneId: { $ref: '#/components/schemas/ID' }
        summary: { type: string }
        confidence: { type: number, format: float }
        hunks:
          type: array
          items:
            type: object
            required: [op, origStart, origEnd, newText, anchors]
            properties:
              op: { type: string, enum: [REPLACE, INSERT, DELETE] }
              origStart: { type: integer, description: 'start index in original text' }
              origEnd: { type: integer, description: 'end index in original text' }
              newText: { type: string, description: 'proposed replacement text' }
              anchors:
                type: object
                description: 'Anchors to re-locate hunk if doc changes'
                properties:
                  before: { type: string, description: 'k-gram preceding hunk' }
                  after: { type: string, description: 'k-gram following hunk' }
                  yjs:
                    type: object
                    description: 'Yjs RelativePosition'
    paths:
  /projects:
    get:
      summary: List projects
      responses:
        '200': { description: OK }
    post:
      summary: Create project
      responses:
        '201': { description: Created }
  /scenes/{id}:
    get: { summary: Get scene, responses: { '200': { description: OK } } }
    patch: { summary: Update scene metadata/content, responses: { '200': { description: OK } } }
  /compose-context:
    post:
      summary: Compose spoiler-safe context
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        '200': { description: OK }

  /refactors:
    post:
      summary: Create a refactor from chat instruction
      description: |
        Interprets an instruction into a Refactor plan and generates Patch proposals.
        MVP supports scopeType=SCENE; v0.2 enables CHAPTER/BOOK/PROJECT.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [projectId, scopeType, instruction]
              properties:
                projectId: { type: string }
                scopeType: { type: string, enum: [SCENE, CHAPTER, BOOK, PROJECT, CUSTOM] }
                scopeId: { type: string, nullable: true }
                instruction: { type: string }
                dryRun: { type: boolean, default: true }
      responses:
        '200':
          description: Refactor created in PREVIEW with patches
    get:
      summary: List refactors

  /refactors/{id}:
    get:
      summary: Get a refactor
    patch:
      summary: Update refactor (status, metadata)

  /refactors/{id}/patches:
    get:
      summary: List patches for a refactor

  /refactors/{id}/apply:
    post:
      summary: Apply accepted patches
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                patchIds: { type: array, items: { type: string } } # if omitted, apply all ACCEPTED
      responses:
        '200': { description: Apply result per patch }
  /patches/{patchId}/apply:
    post:
      summary: Apply selected hunks
      parameters:
        - in: header
          name: X-Idempotency-Key
          schema: { type: string }
        - in: header
          name: If-Match
          schema: { type: string }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                hunkIds: { type: array, items: { type: string } } # if omitted, apply all
      responses:
        '200': { description: Patch applied }
        '412': { description: Precondition failed }
        '409': { description: Patch conflict }
  /generate:
    post:
      summary: Run model action with composed context
      responses: { '200': { description: Stream or text } }
  /rename/preview:
    post:
      summary: Preview global rename
      responses: { '200': { description: OK } }
  /rename/apply:
    post:
      summary: Apply global rename
      responses: { '200': { description: OK } }
  /budgets/{projectId}:
    get: { summary: Get budget, responses: { '200': { description: OK } } }
    patch: { summary: Update budget, responses: { '200': { description: OK } } }
  components: {}
```

API providers must return `PatchProposal[]`.

### WebSocket Events

-- presence.update – user cursors
-- comment.new – new comment
-- suggestion.new – suggestion
-- cost.update – cost meter
- Handshake

client.hello → { userId, projectId, sceneId, e2ee: boolean, token }

server.ready → { sessionId, capabilities: ['presence','crdt','stream','cost'] }
- Presence & Editing

presence.update → { userId, cursor: { from, to }, color }

editor.update → { sceneId, ydocUpdateBase64 } // opaque CRDT delta
- Comments & Suggestions

comment.new → { id, sceneId, author, text, range }

suggestion.new → { id, sceneId, author, text, range }
- AI Streaming & Costs

run.delta → { runId, chunk, index }

run.done → { runId, tokensIn, tokensOut, costUSD }

cost.update → { projectId, spentUSD, remainingUSD }

// Refactor streaming
refactor.progress → { refactorId, stage: 'interpret'|'retrieve'|'rewrite'|'validate', percent }
refactor.patch.proposed → { refactorId, patchId, sceneId, summary, confidence }
refactor.patch.preview → { patchId, unifiedDiffChunk } # chunked for large diffs
refactor.apply.start → { refactorId }
refactor.apply.result → { patchId, status: 'APPLIED'|'FAILED', error? }

### Provider Adapter Interface
```ts
interface ProviderAdapter {
  generate(prompt: string): Promise<string>;
  embed?(text: string[]): Promise<number[][]>;
  moderate?(text: string): Promise<boolean>;
}
```
Adapters: OpenRouter, OpenAI, Anthropic, Ollama/LM Studio.

#### Transport & Headers (performance + safety)

- **Transport choices**
  - HTTP/1.1 for immediate compatibility
  - Consider HTTP/2 or gRPC for streaming and multiplexing
- **Safety headers**
  - `X-Idempotency-Key` to guard against accidental retries
  - `If-Match` with ETags to prevent lost updates
- **Error semantics**
  - `409 Conflict` for edit collisions
  - `412 Precondition Failed` when safety headers are missing or stale

## 8. Context Builder Algorithm
1. **Selection**  
   - Active scene S, plus `N` previous scene **summaries** (configurable).  
   - Entities tagged in S via `SceneEntity` (manual tags) + optional NER over `contentMd`.
2. **Canon gating**  
   - Include `CanonFact` if `revealState=REVEALED`, or `REDACTED_UNTIL_SCENE` with `revealSceneId <= S`, or `REDACTED_UNTIL_DATE <= now()`.  
   - If `includeSpoilersForAuthorTools=true`, include all but mark as `spoiler:true` for preview.
3. **Retrieval & ranking**  
   - For entities in S, fetch top‑k **Embeddings** by cosine similarity; combine with recency and explicit links.  
   - Rank: `score = 0.6*similarity + 0.3*recency + 0.1*explicitTag`.
4. **Budgeting**
   - Truncate to `maxTokens` using tokenizer estimates per target model; always keep scene header + POV/tense.
5. **Prompt object**
   - `system`, `instructions`, `sceneContext[]`, `canonFacts[]`, `styleGuidelines[]`, `guardrails[]`. `system`/`instructions` encode the active `StyleGuide`, scene POV, and tense so prompts preserve them. Emit a **human preview** with redaction badges.
6. **Outputs**
   - Return `{ promptObject, redactions[], tokenEstimate }`. On generation, create **Run** + **CostEvent** rows and stream `run.delta`.

## 8.1 Refactor Chat Algorithm (overview)
**Stages**
1) **Interpret** the instruction → a structured **Edit Plan**:
   - `targets` (entities, locations, motifs), `operations` (add vocal tic, change setting), `constraints` (voice, POV), `scope`.
2) **Retrieve** candidate spans:
   - **Sentence segmentation** of the scene and embedding search over those units.
   - Heuristics flag `isDialogue` (leading/trailing quotes, em‑dash openings) and attempt **speaker attribution** from nearby tags ("X said", existing annotations).
   - Use **SceneEntity** links + embeddings to gather spans; when a `speakerId` is supplied, filter to sentences attributed to that speaker for targeted refactors.
3) **Rewrite** per span:
   - Compose local context (surrounding sentences, Canon facts, style guide). Ask model for revised text + rationale.
4) **Assemble patches**:
   - Build **unified diff** and **CRDT update**; compute confidence scores; chunk previews for UI.
5) **Validate**:
   - Lint contradictions/spoilers; enforce budgets; ensure POV/tense/style constraints; tokenize to respect `maxTokens`; reject hunks that violate these rules or introduce redacted canon.
6) **Apply**:
   - For each ACCEPTED patch, emit Yjs update → broadcast via WS; snapshot scene; log Run/CostEvents.

**Anchoring & resilience**
- Store **Yjs RelativePositions** and **k‑gram text anchors** to re-locate spans even if the document changes before apply.
- Fall back to fuzzy matching if anchors drift.

**Safety rails**
- Canon gates prevent spoiler leaks during retrieval/rewrite.
- Budget guard: estimate cost before generation, block if over.

## 9. UX Flows & Wireframes
- Editor layout with main writing pane, side panels for Codex/Canon facts/Chat.
- Context preview pane showing redaction badges.
- Model picker dropdown with cost estimate.
- Global rename dialog with diff preview.
- Collaborative presence shown via avatar cursors and ranges.
- **Cost meter** in status bar; clicking shows last 20 Runs with tokens and $.
- **Provider keys** settings with “scope to project/provider/model” toggles.
- **Refactor Chat panel**: instruction box → scope selector (Scene/Chapter/Book/Project) → “Preview patches”.
- **Side-by-side diff**: per Scene, per Patch; accept/reject per hunk; confidence pill & rationale tooltip.
- **Batch actions**: Accept all in scene / across scenes; “Apply accepted”.
- **History**: Refactor list with rollbacks.
- **Revert by refactor**: per-scene snapshot restoration.

## 10. Testing Strategy
- **Unit:** context composer redaction, rename engine, cost meter.
- **Property:** CRDT merge invariants.
- **E2E (Playwright):** offline edit → reconnect sync, export/import round-trip, budget cap block.
- **Performance:** 100k-token synthetic benchmark.

- **Security:** key‑vault encryption/decryption tests; E2EE round‑trip test for CRDT updates.

### Additional tests for Refactor Chat
```
Feature: Scene-level patch safety
  Scenario: Preserve collaborator edits during apply
    Given a proposed patch for Scene-2
    And Bob adds a sentence while I review the diff
    When I apply the patch
    Then Bob's sentence remains and the patch is merged correctly (CRDT)
```
```
Feature: Global vocal tic refactor
  Scenario: Attribution and precision
    Given Character "Mara" speaks in 12 scenes
    When I run "Add a clipped ending on excited lines"
    Then only Mara's dialogue lines are changed
    And narration remains unchanged
    And confidence for each patch ≥ 70
```
```
Feature: Setting change constraints
  Scenario: Preserve POV and tense
    Given Chapter-4 is first-person present
    When I refactor setting to "desert checkpoint at noon"
    Then all proposed changes keep first-person present and avoid spoilers
```

```
Feature: Revert by refactor
  Scenario: Version bump and multi-scene rollback
    Given Refactor-5 modified Scene-3 and Scene-4
    When I revert that refactor
    Then snapshots for Scene-3 and Scene-4 are restored
    And version numbers for both scenes increment
```

## 11. Packaging & Deployment
- PWA for web; Docker compose bundling Postgres, Redis, API, web.
- Desktop via Tauri; Electron only if Node APIs required.
- CI: lint, typecheck, tests, build, release notes, signed binaries.
## 12. Threat Model & Privacy Posture (new)
- Assets: manuscripts (contentMd/docCrdt), canon facts, provider keys, run logs.  
- Risks: API key exfiltration, WS MITM, inference leakage, metadata over-collection.  
- Mitigations: TLS everywhere; short‑lived WS tokens; per‑user keyring + envelope encryption; minimal logs; opt‑out telemetry; CSP; SSRF hardened providers; rate limiting.

## 12. Post-MVP Backlog
- Audio dictation
- Themeable UI
- Mobile offline apps
- Plugin marketplace
- Fine‑grained outline mode; index cards; semantic search across project; PDF/DOCX import; EPUB export polish; public plugin API.
- **Refactor Chat v0.2 scope expansion** (Chapter/Book/Project)
- **Dialogue attribution annotator** to improve span retrieval confidence
- **Contradiction linter** across Canon DB and manuscript
- **Style guide learning** from author's accepted patches
