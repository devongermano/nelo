# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nelo is a creative writing application similar to Novelcrafter or Sudowrite, designed for authors to write novels with AI assistance, real-time collaboration, and comprehensive story bible management. The application follows spec-based development with all requirements defined in `/docs/spec-pack.md`.

## Spec-Based Development Workflow

This project uses spec-based development. All features are rigorously defined in `/docs/spec-pack.md` and broken down into implementable tickets in `/docs/tickets/`.

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

### Database Layer

- **ORM**: Prisma with PostgreSQL
- **Package**: `@nelo/db` workspace package exports Prisma client
- **Migrations**: Managed via Prisma migrate in packages/db

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

### Core Entities (Per Spec)

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