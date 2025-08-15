# {APP_NAME} Spec Pack

## 0. Project Guardrails
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

#### Local vs Cloud Model
```
Feature: Local model selection
  Scenario: Choose Ollama locally
    Given Ollama is running
    When I select "Ollama" for Rewrite
    Then generation uses local model and cost $0
```

## 5. Non-Functional Requirements
- **Performance:** <75ms local edits, <300ms collab echo, context assembly <1s for 100k tokens.
- **Reliability:** autosave locally, CRDT merges, crash-safe rehydration.
- **Security:** no server-side training, BYOK, encrypted storage, least-privilege, transparent logs.
- **Accessibility:** keyboard-first, screen reader semantic tags, dyslexia-friendly fonts.

## 6. Domain Model & Schema
### ERD
Project → Book → Chapter → Scene
Entities: Character, Location, Item, Organization (Entity table)
CanonFact linked to Entity
PromptPreset, Persona, ModelProfile
ContextRule
CollabSession, Comment, Suggestion
CostEvent

### Prisma Schema (excerpt)
```prisma
model Project {
  id        String @id @default(uuid())
  name      String
  books     Book[]
}

model Book {
  id        String @id @default(uuid())
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  chapters  Chapter[]
}

model Chapter {
  id       String @id @default(uuid())
  book     Book   @relation(fields: [bookId], references: [id])
  bookId   String
  scenes   Scene[]
}

model Scene {
  id        String @id @default(uuid())
  chapter   Chapter @relation(fields: [chapterId], references: [id])
  chapterId String
  status    String
  pov       String
  tense     String
}

model Entity {
  id       String @id @default(uuid())
  type     String
  name     String
  aliases  String[]
  traits   String[]
  facts    CanonFact[]
}

model CanonFact {
  id          String @id @default(uuid())
  entity      Entity @relation(fields: [entityId], references: [id])
  entityId    String
  fact        String
  revealState String
  revealAt    String?
  confidence  Int
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
}

model CollabSession {
  id      String @id @default(uuid())
  sceneId String
  users   String[]
}

model Comment {
  id      String @id @default(uuid())
  sceneId String
  author  String
  text    String
}

model Suggestion {
  id      String @id @default(uuid())
  sceneId String
  author  String
  text    String
  status  String
}

model CostEvent {
  id        String @id @default(uuid())
  provider  String
  tokensIn  Int
  tokensOut Int
  amount    Float
  createdAt DateTime @default(now())
}
```

## 7. API & Events
### OpenAPI 3.1 (excerpt)
```yaml
openapi: 3.1.0
info:
  title: Nelo API
  version: 0.1.0
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
components: {}
```

### WebSocket Events
- `presence.update` – user cursors
- `comment.new` – new comment
- `suggestion.new` – suggestion
- `cost.update` – cost meter

### Provider Adapter Interface
```ts
interface ProviderAdapter {
  generate(prompt: string): Promise<string>;
  embed?(text: string[]): Promise<number[][]>;
  moderate?(text: string): Promise<boolean>;
}
```
Adapters: OpenRouter, OpenAI, Anthropic, Ollama/LM Studio.

## 8. Context Builder Algorithm
1. Start with active Scene and summaries of N previous scenes.
2. Pull Canon Facts where `reveal_state = revealed` OR `reveal_at <= current`.
3. Pull Codex snippets for entities present in scene.
4. Apply user ContextRules (include/exclude, max tokens).
5. Output JSON prompt and human-readable preview.
6. Stream tokens; log CostEvent.

## 9. UX Flows & Wireframes
- Editor layout with main writing pane, side panels for Codex/Canon facts/Chat.
- Context preview pane showing redaction badges.
- Model picker dropdown with cost estimate.
- Global rename dialog with diff preview.
- Collaborative presence shown via avatar cursors and ranges.

## 10. Testing Strategy
- **Unit:** context composer redaction, rename engine, cost meter.
- **Property:** CRDT merge invariants.
- **E2E (Playwright):** offline edit → reconnect sync, export/import round-trip, budget cap block.
- **Performance:** 100k-token synthetic benchmark.

## 11. Packaging & Deployment
- PWA for web; Docker compose bundling Postgres, Redis, API, web.
- Desktop via Tauri; Electron only if Node APIs required.
- CI: lint, typecheck, tests, build, release notes, signed binaries.

## 12. Post-MVP Backlog
- Audio dictation
- Themeable UI
- Mobile offline apps
- Plugin marketplace

