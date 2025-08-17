# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Non-Interactive Environment

**Claude Code operates in a NON-INTERACTIVE environment.** You are an automated system, not a human at a terminal. This has critical implications for all commands you run.

### Commands You MUST NEVER Use
- `prisma migrate dev` - Requires interactive confirmation
- `prisma migrate reset` (without --force) - Requires interactive confirmation  
- Any command that prompts for user input
- Commands that require TTY interaction
- Interactive git commands (`git rebase -i`, `git add -i`)

### Commands You SHOULD Use Instead
- `prisma db push --force-reset --accept-data-loss` - Non-interactive schema sync
- `prisma migrate deploy` - Apply existing migrations in CI/CD
- `npm ci` instead of `npm install` for deterministic installs
- Always use `--force`, `--yes`, `-y` flags when available
- Use `--force` or `--skip-confirmation` flags wherever possible

### Prisma Database Workflow

#### CRITICAL Migration Rules
1. **NEVER use `prisma migrate dev`** - It requires interactive confirmation
2. **NEVER use `prisma migrate reset` without --force** - It requires confirmation
3. **ALWAYS use non-interactive commands** in your automated environment
4. **ALWAYS verify migrations exist** before using `migrate deploy`

#### Schema Change Workflow
For database schema changes, follow this EXACT sequence:

```bash
# 1. For quick prototyping ONLY (WARNING: not for production)
npx prisma db push --force-reset --accept-data-loss

# 2. For proper migration-based workflow:
# First, ensure migration files exist in prisma/migrations/
# Then apply them non-interactively:
npx prisma migrate deploy

# 3. Always regenerate client after schema changes
npx prisma generate
```

#### Creating New Migrations (Without Interactive Mode)
When you need to create migrations programmatically:

```bash
# Generate migration SQL from schema changes
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > new_migration.sql

# Or use the baseline approach for initial setup
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_init/migration.sql
```

#### Test Database Commands
```bash
# Apply migrations to test database
DATABASE_URL="postgresql://nelo:nelo@localhost:5432/nelo_test" npx prisma migrate deploy

# Reset test database (non-interactive)
DATABASE_URL="postgresql://nelo:nelo@localhost:5432/nelo_test" npx prisma migrate reset --force --skip-seed
```

#### Migration Status Checks (Safe Commands)
These commands are safe as they don't require interaction:
```bash
# Check migration status
npx prisma migrate status

# Mark migration as applied (if needed)
npx prisma migrate resolve --applied <migration-name>
```

### General Principle
**Always research CI/CD documentation and non-interactive modes for any tool.** You are automation, not a developer. When you encounter an "interactive" error, immediately look for the non-interactive alternative.

## Project Overview

Nelo is a creative writing application similar to Novelcrafter or Sudowrite, designed for authors to write novels with AI assistance, real-time collaboration, and comprehensive story bible management. The application follows spec-based development with all requirements defined in `/docs/spec-pack.md`.

## Spec-Based Development Workflow

This project uses spec-based development. All features are rigorously defined in `/docs/spec-pack.md` and broken down into implementable tickets in `/docs/tickets/`.

### CRITICAL: Spec Evolution Protocol

**⚠️ ALWAYS check `/docs/spec-evolution.md` BEFORE implementing from spec-pack.md ⚠️**

The project has evolved beyond the original spec with justified improvements that MUST be preserved.

#### 📚 Documentation Hierarchy (IMPLEMENTATION TRUTH)

**THREE SIMPLE RULES:**
1. **Search `/docs/spec-evolution.md` FIRST** - Contains COMPLETE replacement schemas
2. **If NOT found there** → use `/docs/spec-pack.md` version
3. **NEVER mentally merge** - Use complete definitions from spec-evolution

**Key Points:**
- **spec-pack.md is IMMUTABLE** - Historical record only (DO NOT MODIFY)
- **spec-evolution.md is LIVING** - Update as improvements are discovered
- **spec-evolution.md contains COMPLETE schemas** - Not deltas or patches

#### When You Find Code That Doesn't Match Spec
If you find code that differs from spec-pack.md:
1. **FIRST** check `/docs/spec-evolution.md` - it's likely intentional
2. **IF NOT DOCUMENTED**: Analyze if it's better than spec
3. **IF BETTER**: Document in spec-evolution.md with rationale
4. **IF WORSE**: Fix to match spec or evolution doc
5. **NEVER** assume a deviation is a bug without checking evolution doc

#### Example: SceneStatus Enum
The spec says `status String @default("draft")` but the code uses `status SceneStatus @default(DRAFT)` with an enum.
This is **CORRECT** - see Spec Evolution #001. The enum provides type safety and is intentionally different from the spec.

#### Adding New Evolution Entries
When you determine a deviation from spec-pack.md is justified:

1. **Update spec-evolution.md**:
   - Add/update COMPLETE model in "📚 COMPLETE MODEL DEFINITIONS" section
   - Create numbered evolution entry with rationale
   - Use next sequential number (#033, #034, etc.)
   - Mark status (📋 PLANNED or ✅ IMPLEMENTED)

2. **Update code**:
   - Add comment: `// Spec Evolution #033: [brief reason]`
   - Ensure implementation matches complete schema exactly

3. **Document location**:
   - Complete schemas go in model definitions section
   - Evolution rationale goes in numbered entries
   - NEVER modify spec-pack.md

**Remember**: spec-evolution.md contains COMPLETE REPLACEMENTS, not deltas. When adding an evolution, provide the entire model definition, not just the changes.

### How to Work on Tickets

1. **Select a ticket**: Browse `/docs/tickets/` and choose an unimplemented ticket
   - Complete all `00-structural/` tickets before moving to `01-core/`
   - Check dependencies - only work on tickets whose dependencies are complete
2. **Read the spec**: Each ticket references specific sections of `/docs/spec-pack.md`
3. **Follow acceptance criteria**: Implement exactly what's specified, no more, no less
4. **Write tests**: Create all tests specified in the ticket's testing requirements
5. **Validate**: Run the validation commands listed in the ticket
6. **Update tracker**: Mark the ticket as complete in `/docs/tickets/README.md`

### Ticket System

- **Location**: `/docs/tickets/`
- **Structure**: 
  - `00-structural/` - Foundation improvements (complete these first)
  - `01-core/` - MVP feature implementation
- **Format**: Each ticket contains:
  - Priority level and spec references
  - Current state and target state
  - Concrete acceptance criteria
  - Step-by-step implementation guide
  - Testing requirements
  - Validation commands

### Key Development Principles

- **Isolation**: Each ticket is designed to be completed independently
- **Completeness**: A ticket is only done when ALL acceptance criteria are met
- **Testing**: Every feature requires tests - no exceptions
- **Validation**: Always run `pnpm lint` and `pnpm typecheck` before considering done

## Self-Refine Workflow Protocol 🔄

**CRITICAL: This project uses the Self-Refine pattern for ALL ticket implementations.**

The Self-Refine pattern is an academically-proven iterative refinement approach that improves code quality by ~20% through systematic self-critique and improvement cycles.

### Why Self-Refine?

- **Proven Results**: Academic research shows ~20% improvement in code quality
- **Reduces Bugs**: Catches issues before they reach production
- **Better Design**: Forces deep thinking about implementation approach
- **Documentation**: Creates audit trail of decisions and improvements
- **Continuous Improvement**: Each iteration makes the code better

### The Five Phases of Self-Refine

#### Phase 1: Deep Understanding (Plan Mode) 🔍
1. Enter Plan Mode for read-only analysis
2. Load ticket + spec-pack.md + spec-evolution.md
3. Research codebase thoroughly ("ultrathink" for complex tickets)
4. Identify optimization opportunities
5. Create comprehensive implementation plan

#### Phase 2: Plan Refinement 📝
1. Critique your own plan for completeness
2. Check spec compliance (including evolution overrides)
3. Identify gaps and edge cases
4. Refine plan based on self-critique
5. Document refined plan in GitHub issue

#### Phase 3: Implementation 🔨
1. Exit Plan Mode
2. Create feature branch: `ticket/[number]-[description]`
3. Follow refined plan exactly
4. Commit frequently with clear messages
5. Update issue with progress

#### Phase 4: Critique Loop 🔄
1. Re-enter Plan Mode
2. Review implementation critically
3. Check ALL acceptance criteria
4. Document issues found
5. If issues exist:
   - Exit Plan Mode
   - Implement fixes
   - Return to critique
6. Repeat until critique is positive

#### Phase 5: Completion 🚀
1. Positive critique required
2. Run final validation (`pnpm lint`, `pnpm typecheck`, `pnpm test`)
3. Create PR with refinement metrics
4. Document iteration count

### Quality Standards for Critique

Every critique MUST check:
- ✅ All acceptance criteria met
- ✅ Spec compliance (including evolution)
- ✅ Error handling comprehensive
- ✅ Performance acceptable
- ✅ Tests adequate and passing
- ✅ Code follows project patterns
- ✅ Security considerations addressed

### Iteration Requirements

- **Minimum**: 1 critique iteration required
- **Maximum**: 5 iterations (escalate if more needed)
- **Time Box**: Each phase < 30 minutes
- **Documentation**: Every critique must be logged

### Using Claude Commands

Execute the complete workflow with:
```bash
/self-refine-ticket [issue-number]
```

Other available commands:
- `/claim-next-ticket` - Find and claim available work
- `/critique-implementation` - Perform critique only
- `/refine-plan` - Improve existing plan

### GitHub Integration

All tickets are tracked as GitHub Issues with:
- **Status Labels**: `status:planning`, `status:in-progress`, `status:under-critique`, `status:approved`
- **Refinement Tracking**: Critique iterations logged in issue comments
- **Metrics**: Iteration count tracked for quality analysis

### Example Critique Format

```markdown
## Critique Iteration 1 - [Date/Time]

### Issues Found:
- [ ] Missing error handling in API endpoint
- [ ] Test coverage insufficient (only 60%)
- [ ] Performance issue with N+1 queries

### Proposed Fixes:
1. Add try-catch with proper error responses
2. Add edge case tests for null inputs
3. Use eager loading to prevent N+1

### Overall Assessment: NEEDS IMPROVEMENT ⚠️
```

When critique is positive:
```markdown
## Critique Iteration 2 - [Date/Time]

### Review Complete:
- ✅ All acceptance criteria met
- ✅ Spec compliance verified
- ✅ Tests comprehensive (95% coverage)
- ✅ Performance optimized

### Overall Assessment: APPROVED ✅
```

### Important Notes

- **Never skip critique phase** - It's essential for quality
- **Be thorough but fair** - Focus on real issues, not perfection
- **Document everything** - Future developers need to understand decisions
- **Use Plan Mode** - It provides safe, read-only environment for analysis

## Validation with Typia

This project uses Typia for compile-time validation, replacing runtime validators like class-validator and zod. Key points:

- **Performance**: 3-1000x faster than runtime validation
- **Type Safety**: Validation logic is derived from TypeScript types at compile time
- **@nestia/core**: NestJS integration with TypedRoute decorators for automatic validation
- **SDK Generation**: Auto-generates type-safe client SDK from controllers

### SDK Generation

Generate the client SDK after API changes:

```bash
cd apps/api
ENCRYPTION_KEY='1234567890123456789012345678901a' npx @nestia/sdk sdk --config nestia.config.ts
```

The SDK is generated in `/packages/sdk/src/` with full type safety and automatic validation.

## Essential Commands

### Development
```bash
# Install dependencies (uses pnpm workspaces)
pnpm install

# Start API development server
cd apps/api && pnpm dev

# Start web development server  
cd apps/web && pnpm dev

# Start local infrastructure (Redis, PostgreSQL)
cd infra && docker compose up -d
pnpm db:migrate
pnpm db:seed
```

### Testing
```bash
# Run all tests across workspaces
pnpm test

# Build tests with TypeScript transformations (API)
cd apps/api && pnpm build:test

# Run compiled tests with transformations (API)
cd apps/api && pnpm test:compiled

# Run tests with watch mode
pnpm -r test:watch

# Run specific test file
cd apps/api && pnpm vitest <test-file>
```

### Build & Validation
```bash
# Lint all workspaces
pnpm lint

# Type checking (API)
cd apps/api && pnpm typecheck

# Build API
cd apps/api && pnpm build

# Build Web
cd apps/web && pnpm build
```

### Database Management
```bash
# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed
```

## Architecture Overview

### Current Monorepo Structure
This is a pnpm workspace monorepo with the following key directories:

- **apps/api**: NestJS API using Fastify adapter, WebSockets, Redis for caching
- **apps/web**: Next.js frontend application  
- **packages/db**: Prisma database client and migrations
- **packages/context**: Shared context engine logic (to be consolidated with context-engine)
- **packages/context-engine**: Context composition implementation
- **packages/ai-adapters**: AI provider integrations (OpenAI, Anthropic, etc.)
- **packages/collab**: Real-time collaboration with Yjs
- **packages/editor**: TipTap editor components
- **infra**: Docker Compose configuration for local services

### Target Architecture (Per Spec)

The optimal architecture we're building towards includes:

#### Core Packages
- **@nelo/db**: Database client, migrations, Prisma models with pgvector
- **@nelo/shared-types**: TypeScript interfaces and types shared across packages
- **@nelo/auth**: Authentication, authorization, JWT handling, role-based access
- **@nelo/crypto**: Encryption utilities for E2EE manuscripts and provider keys
- **@nelo/ai-adapters**: Provider adapters (OpenAI, Anthropic, Ollama, LM Studio)
- **@nelo/context-engine**: Spoiler-safe context composition with canon gating
- **@nelo/collab**: Yjs CRDT for real-time collaborative editing
- **@nelo/editor**: TipTap (ProseMirror) editor with Markdown I/O
- **@nelo/offline**: PWA support with Service Worker and IndexedDB

#### Data Flow Architecture
1. **User Action** → Web client initiates request
2. **API Gateway** → NestJS validates and routes
3. **Business Logic** → Services process with proper authorization
4. **Context Building** → Compose spoiler-safe context from canon
5. **AI Generation** → Provider adapters handle model interactions
6. **CRDT Updates** → Yjs processes collaborative edits
7. **WebSocket Broadcast** → Real-time sync to all clients
8. **Persistence** → PostgreSQL for data, Redis for cache/presence

### API Architecture (apps/api)

The API is built with NestJS using the Fastify adapter for performance. Key architectural patterns:

1. **Module Organization**: Features are organized into modules (projects, scenes, context, gateway)
2. **WebSocket Gateway**: Real-time collaboration using WebSockets with presence tracking
3. **Redis Integration**: Used for caching and real-time state management
4. **Exception Handling**: Global exception filter with environment-aware error responses
5. **Rate Limiting**: Throttler configured with short/medium/long term limits
6. **Validation**: Compile-time validation using Typia with TypeScript transformers (3-1000x faster than runtime validators)
7. **Idempotency**: Interceptor for handling idempotent requests via If-Match headers
8. **Configuration**: Environment-based configuration with validation

### Key API Components

- **Main Entry**: `apps/api/src/main.ts` - Bootstraps NestJS with Fastify, CORS, Helmet security
- **App Module**: `apps/api/src/app.module.ts` - Root module with throttling configuration
- **Gateway Module**: WebSocket handling for real-time collaboration
- **Scenes Module**: Core business logic for scene management with optimistic concurrency control
- **Redis Factory**: Connection management for Redis instances

### Testing Strategy

- **Unit Tests**: Vitest with mock providers for services
- **E2E Tests**: Supertest for API endpoint testing
- **Setup File**: `apps/api/test/setup.ts` for test environment configuration
- **Test Naming**: `*.test.ts` for unit tests, `*.e2e.test.ts` for integration tests

#### Testing Against Evolution
Tests validate the EVOLVED spec, not the original. For example:
- SceneStatus should be an enum, NOT a string
- Foreign keys should CASCADE delete
- Version fields should exist for optimistic locking
- See `/docs/spec-evolution.md` for what the tests should validate

### Database Layer

- **ORM**: Prisma with PostgreSQL (pgvector extension for embeddings)
- **Package**: `@nelo/db` workspace package exports Prisma client
- **Schema Management**: Use `prisma db push` for development (NOT `migrate dev`)

### Frontend (apps/web)

- Next.js application with TypeScript
- Minimal setup, ready for expansion
- Configured to connect to API at localhost:3001

### Development Workflow

1. Infrastructure runs in Docker (Redis, PostgreSQL)
2. API and Web apps run locally for hot-reloading
3. Workspace packages are linked via pnpm
4. Environment variables control configuration
5. Vitest for testing with global test utilities

## Domain Model

### Core Entities (Original Spec - See Evolution Doc for Updates)

**Note**: The descriptions below reflect the original spec. See `/docs/spec-evolution.md` for improvements like:
- `Scene.status` is actually a SceneStatus enum, not a string
- All foreign keys CASCADE delete
- Version fields added for optimistic locking

#### Manuscript Structure
- **Project** → **Book** → **Chapter** → **Scene**
- Each Scene contains:
  - `contentMd`: Canonical Markdown text
  - `docCrdt`: Yjs document for real-time collaboration
  - `version`: Optimistic locking counter
  - `status`: draft|revised|final
  - `pov`, `tense`: Narrative metadata

#### Story Bible (Codex)
- **Entity**: Characters, Locations, Items, Organizations
  - `aliases[]`: Alternative names
  - `traits[]`: Characteristics
- **CanonFact**: Facts about entities
  - `revealState`: PLANNED|REVEALED|REDACTED_UNTIL_SCENE
  - `revealSceneId`: When fact becomes known
  - Enables spoiler-safe context composition

#### AI & Generation
- **PromptPreset**: Reusable prompt templates
- **ModelProfile**: AI provider configurations
- **Run**: Track each AI generation
- **CostEvent**: Monitor token usage and costs
- **ProviderKey**: Encrypted API keys (BYOK)

#### Collaboration
- **CollabSession**: Active editing sessions
- **Comment/Suggestion**: Feedback on scenes
- **Presence**: Real-time cursor positions

#### Refactoring (Advanced)
- **Refactor**: Global change request
- **Patch**: Proposed changes per scene
- **Hunk**: Granular diff segments
- **EditSpan**: Precise text anchoring

#### Access Control
- **User** → **Team** → **Membership**
- **ProjectMember**: User roles in projects
- **Role**: OWNER|MAINTAINER|WRITER|READER
- **Budget**: Cost limits per project

## Documentation Standards

### CRITICAL: Clean Documentation Principles

**You MUST follow these documentation standards to maintain a clean, navigable codebase.**

#### Documentation Hierarchy

1. **Primary Documentation** (`/docs/`)
   - `spec-pack.md` - Source of truth for all requirements
   - `database-migrations.md` - Database migration guide
   - `adr-*.md` - Architecture Decision Records
   - `/docs/tickets/` - Development tickets and tracking

2. **Package Documentation** (`/packages/*/`)
   - `README.md` - MINIMAL, only:
     - Brief description (1-2 lines)
     - Quick start commands
     - Link to main docs: "See `/docs/` for detailed documentation"
   - NO duplicate information from `/docs/`

3. **Application Documentation** (`/apps/*/`)
   - Same as packages - minimal README
   - Implementation details in code comments ONLY when complex

#### What to Update vs Create

**ALWAYS UPDATE existing documentation:**
- `/docs/database-migrations.md` - Add sections, don't create new files
- `/docs/tickets/README.md` - Update status tracker
- `/CLAUDE.md` - Add sections for new patterns
- Existing package READMEs - Keep minimal

**ONLY CREATE new documentation when:**
- New ADR for architectural decisions (`/docs/adr-XXX-title.md`)
- New migration SQL files (in migrations folder)
- New tickets (in `/docs/tickets/`)
- Initial minimal README for new packages

#### Documentation Anti-Patterns (NEVER DO)

❌ **NEVER**:
- Create multiple files for the same topic
- Duplicate information across files
- Create lengthy package READMEs
- Add setup guides in multiple places
- Create "docs" folders in packages
- Write the same instructions twice
- Create files like `SETUP.md`, `INSTALL.md`, `CONFIGURATION.md`

✅ **ALWAYS**:
- Link to primary docs from package READMEs
- Keep single source of truth
- Update existing sections instead of creating new files
- Use clear section headers in existing docs
- Maintain the established hierarchy

#### Examples

**BAD** (creates redundancy):
```
/packages/db/
├── README.md (500 lines explaining migrations)
├── MIGRATIONS.md (duplicate info)
├── docs/
│   ├── setup.md
│   └── troubleshooting.md
```

**GOOD** (clean structure):
```
/packages/db/
├── README.md (10 lines with link to /docs/database-migrations.md)
```

**BAD** README in package:
```markdown
# Database Package

## Installation
[100 lines of setup instructions]

## Migrations
[200 lines duplicating /docs/database-migrations.md]

## Troubleshooting
[150 lines of common issues]
```

**GOOD** README in package:
```markdown
# @nelo/db

Prisma database client and migrations for Nelo.

## Quick Start
\`\`\`bash
pnpm test           # Run tests
pnpm db:migrate     # Run migrations
\`\`\`

See `/docs/database-migrations.md` for detailed documentation.
```

#### When Adding New Information

1. **First** check if a relevant document exists in `/docs/`
2. **If yes**: Add a new section to that document
3. **If no**: Consider if it belongs in an existing document
4. **Last resort**: Create a new file in `/docs/` (not in packages)

#### Test Documentation

- Test files are self-documenting through descriptive test names
- Use `describe()` and `it()` blocks with clear descriptions
- NO separate test documentation files
- Example tests serve as usage documentation

#### Migration Documentation

All migration documentation goes in `/docs/database-migrations.md`:
- Add new sections for new migration types
- Include rollback procedures in same file
- Keep troubleshooting in one place