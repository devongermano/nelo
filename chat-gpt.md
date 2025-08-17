Perfect—here’s a **copy‑paste, step‑by‑step implementation plan** you (or Claude Code) can run with. I’ve written it so you can drop chunks straight into your repo as commits/PRs. I reference the relevant parts of your two docs as we go so it’s clear why each change exists. &#x20;

---

## 0) Assumptions

* Monorepo layout and stack match your Spec Pack (Next.js web, NestJS API, Prisma/Postgres, Yjs/TipTap, Redis, Tauri).&#x20;
* You want to **apply the P0 items** from my review first (enum alignment, style‑guide rename, E2EE degrade path, permission matrix, hosted entitlements, plugin sandbox spec, embedding policy decision, tokenizer registry, soft delete/audit, idempotency enforcement).&#x20;
* Your **Spec Evolution** entries #001, #002, #003, #004 are authoritative and already partially implemented; #006 (StyleGuide.rules→guide) is still pending.&#x20;

If anything below disagrees with your “**Never modify original `/docs/spec-pack.md`**” guidance, I include a “compiled spec” option that preserves your original file untouched (see §7).&#x20;

---

## 1) Branch & PR scaffolding

```bash
git checkout -b chore/spec-p0-consolidation
```

Create a PR titled **“Spec P0 consolidation: enums, styleguide rename, E2EE degrade, perms, billing, tokenizer, soft delete, idempotency.”**

---

## 2) Prisma schema updates (Enums, StyleGuide rename, Audit/Soft delete, ModelProfile)

> Why: Your Evolution log mandates enums for `Scene.status` and `Entity.type` (#001, #002) and notes the pending StyleGuide rename (#006). Add audit/soft‑delete (P0) and expand `ModelProfile` so cost/token estimation is first‑class. &#x20;

Edit: `/packages/db/prisma/schema.prisma`

**2.1 Enums + usage (idempotent if already applied)**

```prisma
// Spec Evolution #001
enum SceneStatus { DRAFT REVISED FINAL }

// Spec Evolution #002
enum EntityType { CHARACTER LOCATION ITEM ORGANIZATION OTHER }
```

Find `Scene.status` and **ensure**:

```prisma
status SceneStatus @default(DRAFT)
```

Find `Entity.type` and **ensure**:

```prisma
type EntityType
```

(If these lines already exist per #001/#002, no change.)&#x20;

**2.2 StyleGuide field rename (rules → guide)**

```prisma
model StyleGuide {
  id        String   @id @default(uuid())
  project   Project  @relation(fields: [projectId], references: [id])
  projectId String
  name      String
  guide     Json     // was 'rules'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

(You called this out as **NEEDS FIX** in Evolution #006.)&#x20;

**2.3 Audit & soft delete fields (P0)**
Add these fields to: `Project`, `Book`, `Chapter`, `Scene`, `Refactor`, `Patch`, `Hunk`, `Snapshot`. (You flagged audit fields as an “UNDER REVIEW” pattern in #005; this promotes them to implemented for core models.)&#x20;

```prisma
createdBy String?
updatedBy String?
deletedAt DateTime?
deletedBy String?
```

**2.4 ModelProfile expansion (for cost/tokenizer awareness)**

```prisma
model ModelProfile {
  id              String @id @default(uuid())
  name            String
  provider        String
  config          Json
  maxInputTokens  Int?
  maxOutputTokens Int?
  pricing         Json?    // { inPerMTok: number, outPerMTok: number, currency: "USD" }
  tokenizer       String?  // e.g. "tiktoken:gpt-4o-mini" | "anthropic:claude-3.5"
  throughputQPS   Int?
  supportsNSFW    Boolean? @default(false)
}
```

(Aligns with your “cost meter & budgets” objective and provider adapters.)&#x20;

**2.5 Migrate (create a single migration including 2.2–2.4)**

*If enums are already in DB from prior migrations, Prisma will noop those parts; otherwise it generates SQL.*

```bash
pnpm --filter @repo/db prisma migrate dev -n p0_consolidation
```

If Prisma struggles to rename `rules→guide`, add a **manual SQL step** in the migration:

```sql
-- StyleGuide.rules -> guide
ALTER TABLE "StyleGuide" RENAME COLUMN "rules" TO "guide";
```

If you still have string→enum conversion to do (first‑time enum adoption):

```sql
-- Scene.status: String -> SceneStatus enum
DO $$ BEGIN
  CREATE TYPE "SceneStatus" AS ENUM ('DRAFT','REVISED','FINAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Scene"
  ALTER COLUMN "status" TYPE "SceneStatus"
  USING UPPER("status")::"SceneStatus";

ALTER TABLE "Scene"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Entity.type: String -> EntityType enum
DO $$ BEGIN
  CREATE TYPE "EntityType" AS ENUM ('CHARACTER','LOCATION','ITEM','ORGANIZATION','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Entity"
  ALTER COLUMN "type" TYPE "EntityType"
  USING UPPER("type")::"EntityType";
```

---

## 3) OpenAPI updates (enums, tokenizer endpoint, E2EE error)

> Why: Your API excerpt still shows `Scene.status: string` and lacks the tokenizer estimate endpoint and E2EE‑degrade semantics.&#x20;

Edit: `/docs/api/openapi.yaml` (or the path you keep your OpenAPI).

**3.1 Replace string fields with enums**

```yaml
components:
  schemas:
    SceneStatus:
      type: string
      enum: [DRAFT, REVISED, FINAL]
    EntityType:
      type: string
      enum: [CHARACTER, LOCATION, ITEM, ORGANIZATION, OTHER]

    Scene:
      type: object
      properties:
        status: { $ref: '#/components/schemas/SceneStatus' }
        ...
    Entity:
      type: object
      properties:
        type: { $ref: '#/components/schemas/EntityType' }
```

**3.2 Add TokenizerEstimate schema + endpoint**

```yaml
components:
  schemas:
    TokenizerEstimate:
      type: object
      properties:
        modelProfileId: { type: string, format: uuid }
        text: { type: string }
        estInputTokens: { type: integer }
        estOutputTokens: { type: integer, description: 'caller-provided max or estimate' }

paths:
  /tokenize/estimate:
    post:
      summary: Estimate tokens for input using the model's tokenizer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [modelProfileId, text]
              properties:
                modelProfileId: { type: string }
                text: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/TokenizerEstimate' }
```

**3.3 E2EE degrade: explicit error**
Add to `GenerateRequest` an optional client hint and define a **409 error** for remote‑incompatible E2EE runs.&#x20;

```yaml
components:
  schemas:
    GenerateRequest:
      type: object
      properties:
        sceneId: { $ref: '#/components/schemas/ID' }
        action: { type: string, enum: [WRITE, REWRITE, DESCRIBE] }
        modelProfileId: { $ref: '#/components/schemas/ID' }
        stream: { type: boolean, default: true }
        promptOverride: { type: object }
        e2eeRequired: { type: boolean, default: false }

paths:
  /generate:
    post:
      responses:
        '409':
          description: E2EE_REQUIRED (remote provider cannot be used with E2EE)
          content:
            application/json:
              schema:
                type: object
                properties:
                  code: { type: string, enum: [E2EE_REQUIRED] }
                  options:
                    type: array
                    items: { type: string, enum: [USE_LOCAL_MODEL, DISABLE_E2EE_FOR_RUN, CANCEL] }
```

---

## 4) API implementation (NestJS): tokenizer, E2EE‑degrade, idempotency

> Why: You already defined WebSockets, runs, budgets—this wires the missing pieces for P0.&#x20;

**4.1 Tokenizer estimate endpoint**

Create: `/apps/api/src/tokenizer/tokenizer.controller.ts`

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { TokenizerService } from './tokenizer.service';

@Controller('tokenize')
export class TokenizerController {
  constructor(private readonly svc: TokenizerService) {}
  @Post('estimate')
  async estimate(@Body() dto: { modelProfileId: string; text: string }) {
    return this.svc.estimate(dto);
  }
}
```

Create: `/apps/api/src/tokenizer/tokenizer.service.ts`

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@repo/db';
import { getTokenizer } from '../util/tokenizers'; // implement registry below

@Injectable()
export class TokenizerService {
  private prisma = new PrismaClient();

  async estimate({ modelProfileId, text }: { modelProfileId: string; text: string }) {
    const mp = await this.prisma.modelProfile.findUnique({ where: { id: modelProfileId }});
    if (!mp) throw new NotFoundException('ModelProfile not found');

    const tokenizer = getTokenizer(mp.tokenizer || mp.name);
    const estInputTokens = tokenizer.estimate(text);
    return { modelProfileId, text, estInputTokens, estOutputTokens: 0 };
  }
}
```

Create a tiny tokenizer registry: `/apps/api/src/util/tokenizers.ts`

```ts
type Tokenizer = { estimate: (text: string) => number };

export function getTokenizer(key: string): Tokenizer {
  // simple heuristics as fallback; plug real tokenizers as deps below
  if (key.startsWith('tiktoken') || key.includes('gpt')) {
    return { estimate: (t) => Math.ceil(t.length / 4) }; // rough GPT heuristic
  }
  if (key.startsWith('anthropic') || key.includes('claude')) {
    return { estimate: (t) => Math.ceil(t.length / 4) }; // similar heuristic
  }
  return { estimate: (t) => Math.ceil(t.length / 4) };
}
```

*Optional*: add real libs in `apps/api/package.json` later (`@dqbd/tiktoken`, `@anthropic-ai/tokenizer`) and swap in exact estimators.

**4.2 E2EE‑degrade behavior in /generate**

In your `GenerateController`, before dispatching to a provider:

```ts
// pseudo-code inside POST /generate
const project = await prisma.project.findUnique({ where: { id: projectId }});
const e2eeOn = /* read from project settings / session handshake */ true; // per your spec
const provider = await prisma.modelProfile.findUnique({ where: { id: dto.modelProfileId }});

// If E2EE is on and provider is remote -> block with options
if (dto.e2eeRequired && provider?.provider !== 'ollama' && provider?.provider !== 'lmstudio') {
  return res.status(409).json({
    code: 'E2EE_REQUIRED',
    options: ['USE_LOCAL_MODEL','DISABLE_E2EE_FOR_RUN','CANCEL']
  });
}

// If user selected DISABLE_E2EE_FOR_RUN (frontend will retry without e2eeRequired)
// ... proceed, but emit a SecurityEvent audit row
```

This maps exactly to your guardrail (“cloud features that can’t work with E2EE must degrade gracefully with user warning”).&#x20;

**4.3 Idempotency & optimistic locking (headers)**

Create an **IdempotencyInterceptor** and a **VersionGuard**.

`/apps/api/src/common/interceptors/idempotency.interceptor.ts`

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import Redis from 'ioredis';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private redis = new Redis(process.env.REDIS_URL!);

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req: any = ctx.switchToHttp().getRequest();
    const key = req.header('X-Idempotency-Key');
    if (!key) return next.handle();

    const exists = await this.redis.get(`idem:${key}`);
    if (exists) throw new BadRequestException('Duplicate request'); // or replay cached response

    await this.redis.setex(`idem:${key}`, 60 * 10, '1'); // 10 min TTL
    return next.handle().pipe(tap({ error: async () => await this.redis.del(`idem:${key}`) }));
  }
}
```

Apply to mutating routes (patch/apply, rename/apply, etc.). Your Spec Pack already documents these headers and error semantics.&#x20;

For **optimistic locking** on patch apply (uses `If-Match` with ETag `W/"scene-{id}-v{version}"`):

```ts
// in PatchesController.apply()
const etag = req.header('If-Match'); // expect: W/"scene-<id>-v<version>"
const m = /^W\/"scene-(.+)-v(\d+)"$/.exec(etag || '');
if (!m) return res.status(412).json({ code: 'PRECONDITION_FAILED' });

const [sceneId, versionStr] = [m[1], m[2]];
const expectedVersion = parseInt(versionStr, 10);

// guard the update
await prisma.scene.update({
  where: { id: sceneId, version: expectedVersion },
  data: { contentMd: newContent, version: { increment: 1 } }
}).catch(() => res.status(412).json({ code: 'PRECONDITION_FAILED' }));
```

(NB: This aligns with your Evolution #004 optimistic locking pattern.)&#x20;

---

## 5) Permissions (spec + enforcement)

> Why: You have roles (OWNER|MAINTAINER|WRITER|READER) but not a concrete matrix of actions.&#x20;

**5.1 Add doc** `/docs/permissions.md`

```md
# Permission Matrix (v0.1)

| Resource     | Action                          | OWNER | MAINTAINER | WRITER | READER |
|--------------|----------------------------------|:-----:|:----------:|:------:|:------:|
| Project      | Invite member                    |  ✓    |     ✓      |        |        |
| Budget       | Update                           |  ✓    |     ✓      |        |        |
| ProviderKey  | Create/use local model           |  ✓    |     ✓      |   ✓    |        |
| ProviderKey  | Use cloud model                  |  ✓    |     ✓      |   ✓*   |        |
| Scene        | Apply refactor patch             |  ✓    |     ✓      |   ✓    |        |
| Scene        | Force‑apply conflicting patch    |  ✓    |     ✓      |        |        |
| Export/Import| Export project                   |  ✓    |     ✓      |   ✓    |        |
| Security     | Toggle E2EE                      |  ✓    |     ✓      |        |        |

\* subject to project policy
```

**5.2 Enforce in code**
Add a small **policy** helper and a Nest **Guard**:

`/apps/api/src/auth/policy.ts`

```ts
type Role = 'OWNER'|'MAINTAINER'|'WRITER'|'READER';
type Action =
  | 'project.invite'|'budget.update'|'provider.local.use'|'provider.cloud.use'
  | 'scene.patch.apply'|'scene.patch.force'|'project.export'|'security.e2ee.toggle';

export function can(role: Role, action: Action): boolean {
  const table: Record<Action, Role[]> = {
    'project.invite':       ['OWNER','MAINTAINER'],
    'budget.update':        ['OWNER','MAINTAINER'],
    'provider.local.use':   ['OWNER','MAINTAINER','WRITER'],
    'provider.cloud.use':   ['OWNER','MAINTAINER','WRITER'],
    'scene.patch.apply':    ['OWNER','MAINTAINER','WRITER'],
    'scene.patch.force':    ['OWNER','MAINTAINER'],
    'project.export':       ['OWNER','MAINTAINER','WRITER'],
    'security.e2ee.toggle': ['OWNER','MAINTAINER'],
  };
  return table[action].includes(role);
}
```

`/apps/api/src/auth/policy.guard.ts`

```ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { can } from './policy';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private action: Parameters<typeof can>[1]) {}
  canActivate(ctx: ExecutionContext) {
    const req: any = ctx.switchToHttp().getRequest();
    const role: any = req.user.role; // resolve from ProjectMember
    if (!can(role, this.action)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

Use: `@UseGuards(new PolicyGuard('scene.patch.apply'))` on the relevant routes.

---

## 6) Hosted product: plans & enforcement

> Why: Your Spec Pack has budgets/costs but no plan SKUs/limits. Add a doc + simple enforcement hook.&#x20;

**6.1 Add doc** `/docs/hosted-plans.md`

```md
# Plans (hosted)

- Free (beta): 1 project, 2 collaborators, local models only, no server-side AI
- Starter $8: 3 projects, 5 collaborators, server AI up to 200k tokens/day
- Pro $20: 10 projects, 10 collaborators, server AI up to 1M tokens/day, priority WS slots
- Team $50: unlimited projects, 25 collaborators, 3M tokens/day, SSO (SAML), audit logs

Enforcement points:
- Project create limit
- Max active collaborators per project
- Server AI daily token cap (sum of Run.inputTokens + Run.outputTokens)
- WS concurrent sessions cap
```

**6.2 Add a simple plan checker** `/apps/api/src/billing/plan.guard.ts`

```ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private feature: 'serverAI'|'projectLimit'|'collabLimit') {}
  async canActivate(ctx: ExecutionContext) {
    const req: any = ctx.switchToHttp().getRequest();
    const plan = req.user.plan; // resolve from account
    // pseudo logic
    if (this.feature==='serverAI' && plan === 'Free') throw new ForbiddenException('Server AI not allowed on Free');
    return true;
  }
}
```

Apply to `/generate` etc. (You already log runs/tokens; reuse to enforce daily caps.)&#x20;

---

## 7) Spec documentation strategy (keep original vs compiled spec)

Your Evolution log says **“Never modify the original `/docs/spec-pack.md`.”** If you want to preserve that rule, add a **compiled spec** that merges pack + evolutions for readers.&#x20;

**Option A (preserve original):**
Create `/docs/spec-compiled.md` and paste the updated OpenAPI snippets, enum corrections, and new sections (permissions, E2EE degrade, hosted plans). Add at the top:

> “This document compiles `/docs/spec-pack.md` plus all accepted entries in `/docs/spec-evolution.md`. If conflicts exist, **evolution entries override**.”&#x20;

**Option B (living spec):**
Rename original to `/docs/spec-pack.v0.md` and update `/docs/spec-pack.md` with the changes above. (Your call; I’ve provided content either way.)

---

## 8) Plugin security/sandbox spec (doc only for now)

> Why: You plan a plugin marketplace after MVP; define the manifest and permissions now (P0 spec).&#x20;

Create `/docs/plugin-manifest.md`:

````md
# Plugin Manifest (v0.1)

```json
{
  "name": "example.plugin",
  "version": "0.1.0",
  "displayName": "Example Plugin",
  "description": "Adds a character sheet generator",
  "capabilities": ["prompt.execute","project.read","scene.read","scene.write"],
  "network": false,
  "models": ["local:ollama:*","openai:gpt-4o-mini"],
  "permissions": {
    "files": ["project:/**/*"],
    "crdt": ["read","write"]
  }
}
````

* **No arbitrary network by default** (`network:false`).
* Capabilities are explicit; UI shows a consent screen before install.
* Desktop (Tauri): run plugins in isolated process; Web: worker w/ CSP.

````

---

## 9) Embedding policy (choose now)

Your schema uses `vector(1536)` (pgvector). Document the decision. :contentReference[oaicite:24]{index=24}

- **Recommended for v0.1:** keep `vector(1536)`; document it in `/docs/embedding-policy.md` with a migration plan if you add 768‑dim later.  
- Add a note in the doc: “Index build: use `ivfflat` with `lists = sqrt(n_rows)`; rebuild after bulk loads.”

Create `/docs/embedding-policy.md`:
```md
We standardize on 1536-dim embeddings for v0.1. Future: dual-index tables if needed.
Migration plan: create `Embedding768` table, backfill asynchronously, switch retrieval client-side by model.
````

---

## 10) E2EE degrade UX (front-end copy + events)

> Why: Spec says “must degrade gracefully (user warned)”—make it concrete.&#x20;

Create `/docs/e2ee-degrade.md`:

```md
# E2EE Degrade Flow

When user clicks "Write with AI":
1) If E2EE is ON and selected ModelProfile is remote:
   - Show modal:
     Title: "End-to-end encryption is enabled"
     Body: "This run would require sending unencrypted content to a cloud model. Choose:"
     Buttons:
       - Use local model (switch model to local and proceed)
       - Disable E2EE for this run (one-time exception; log SecurityEvent)
       - Cancel
2) If "Disable for this run":
   - Retry /generate with { e2eeRequired: false }
   - Create SecurityEvent { type: 'E2EE_TEMPORARY_DISABLE', runId, userId, timestamp }
3) If "Use local model":
   - Switch ModelPicker to a local adapter (ollama/lmstudio) and re-run.
```

Frontend emits `security.event` over WS for audit stream (optional). **Run logs** must mark the run as `e2ee=false` if exception chosen.&#x20;

---

## 11) Tests to add (names + scaffolds)

> Your Spec Pack already lists testing strategy. Add these specific cases.&#x20;

* **Tokenizer parity unit test**

    * `apps/api/test/tokenizer.estimate.spec.ts`: assert `estimate()` returns >0 and is monotonic with input length for each `ModelProfile`.

* **E2EE degrade e2e (Playwright)**

    * Attempt generation with E2EE ON + remote model → expect 409 + modal with 3 options → choose each path and assert behavior.

* **Idempotency**

    * Double POST `/patches/{id}/apply` with same `X-Idempotency-Key` → second call 400/duplicate (or replay).

* **Optimistic locking**

    * Apply with stale `If-Match` → 412; update with correct ETag → 200. (Matches your Evolution #004 usage pattern.)&#x20;

* **Permissions**

    * Table‑driven test: each action vs role matrix returns 200/403.

* **Soft delete**

    * Soft delete a Scene; default list excludes; “includeDeleted=true” returns it.

---

## 12) Hosted SLOs (small doc addition)

Add to `/docs/hosted-plans.md`:

```md
SLOs:
- WS connect p50 < 300ms
- AI start p75 < 1s
- Patch apply p95 < 400ms
Error budget: 1% failed runs (5xx or provider errors)
KPI: Redaction leakage rate = 0 (unit tests in CI for Canon gate)
```

(You already track runs & costs per Spec Pack; this clarifies targets.)&#x20;

---

## 13) Update Spec docs (quick inserts)

**If keeping original Spec Pack untouched:**

* Create `/docs/spec-compiled.md` that includes:

    * The enums/fields corrections (SceneStatus, EntityType, StyleGuide.guide) from Evolution (#001, #002, #006).&#x20;
    * New sections: permissions, E2EE degrade, hosted plans, tokenizer endpoint, embedding policy—integrated with your existing sections on guardrails, AI adapters, budgets, WS events.&#x20;

**If making Spec Pack living:**

* Edit `/docs/spec-pack.md`:

    * Replace `Scene.status: string` with enum.
    * Replace `Entity.type: string` with enum.
    * Replace `StyleGuide.rules` with `guide`.
    * Append the new docs as appendices.

---

## 14) Commit messages (ready to paste)

```
feat(schema): adopt enums for Scene.status & Entity.type; rename StyleGuide.rules->guide; add audit/soft-delete; expand ModelProfile

feat(api): add /tokenize/estimate + tokenizer registry; implement E2EE-degrade 409 path; idempotency interceptor; ETag enforcing optimistic lock

docs: permissions matrix; hosted plans & SLOs; E2EE degrade UX; embedding policy; compiled spec

test: add e2e for E2EE degrade & idempotency; unit tests for tokenizer estimate; perms table tests
```

---

## 15) Post‑merge checklist

* Run migrations on dev DB.
* Verify OpenAPI renders in Swagger UI.
* Smoke test:

    * Create project, toggle E2EE, pick remote model → confirm modal & options.
    * Apply a patch with `If-Match` header mismatch → 412.
    * Tokenize/estimate returns plausible numbers.

---

### That’s it

This covers every P0 change we discussed with **specific file edits, migrations, endpoints, guards, and docs** so you can execute immediately (or hand to Claude Code). The instructions align with your existing guardrails (E2EE, budgets, adapters, WS events) and the Evolution log’s intent (enums, optimistic locking, field rename). &#x20;

If you want me to tailor the permission matrix or hosted SKUs further (e.g., different caps/tiers), I can draft those variants in the same format.
