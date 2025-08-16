# Ticket: 00-structural/002 - Create Shared Types Package

## Priority
**Critical** - Type safety across packages requires shared type definitions

## Spec Reference
`/docs/spec-pack.md` sections:
- Section 7: API & Events (lines 604-851)
- OpenAPI schemas (lines 612-801)

## Dependencies
- 00-structural/000 (Complete Typia Setup) - Need Typia for validation
- 00-structural/001 (Database Schema Update) - Need correct models first

## Current State
- No shared types package exists
- Types are duplicated across packages
- DTOs in `/apps/api/src/scenes/dto/` are local to API
- No shared interfaces for cross-package communication
- Using class-validator/zod for validation (being replaced by Typia)

## Target State
A new `@nelo/shared-types` package containing:
- All DTOs as pure TypeScript interfaces with Typia tags
- Shared interfaces for providers, context, etc.
- Type exports from Prisma client
- Common enums and constants
- WebSocket event types
- Typia validation functions for all types

## Acceptance Criteria
- [ ] Package `@nelo/shared-types` exists at `/packages/shared-types`
- [ ] All DTOs from spec are defined as TypeScript interfaces
- [ ] Package exports Prisma-generated types
- [ ] WebSocket event types are defined
- [ ] Package is properly configured in pnpm workspace
- [ ] Other packages can import from `@nelo/shared-types`
- [ ] TypeScript compilation succeeds

## Implementation Steps

1. **Create package structure**:
   ```bash
   mkdir -p packages/shared-types/src
   cd packages/shared-types
   ```

2. **Create package.json**:
   ```json
   {
     "name": "@nelo/shared-types",
     "version": "0.0.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "typecheck": "tsc --noEmit"
     },
     "dependencies": {
       "@nelo/db": "workspace:*",
       "typia": "^6.0.0"
     },
     "devDependencies": {
       "typescript": "^5.3.0"
     }
   }
   ```

3. **Create tsconfig.json**:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "rootDir": "./src",
       "outDir": "./dist"
     },
     "include": ["src/**/*"]
   }
   ```

4. **Create core type files**:

   `/packages/shared-types/src/index.ts`:
   ```typescript
   // Re-export Prisma types
   export * from '@nelo/db';
   
   // Export all type modules
   export * from './api';
   export * from './websocket';
   export * from './context';
   export * from './ai';
   export * from './refactor';
   ```

5. **Create API types** (`/packages/shared-types/src/api.ts`):
   ```typescript
   // Based on OpenAPI spec in spec-pack.md
   import { tags } from "typia";
   
   export interface ComposeContextRequest {
     sceneId: string & tags.Format<"uuid">;
     windowScenes?: number & tags.Minimum<1> & tags.Maximum<10> & tags.Default<3>;
     includeSpoilersForAuthorTools?: boolean & tags.Default<false>;
     maxTokens?: number & tags.Type<"uint32"> & tags.Default<2000>;
     rules?: Record<string, any>;
   }
   
   export interface ComposeContextResponse {
     promptObject: PromptObject;
     redactions: Redaction[];
     tokenEstimate: number;
   }
   
   export interface Redaction {
     factId: string;
     reason: string;
   }
   
   export interface PromptObject {
     system: string;
     instructions: string;
     sceneContext: SceneContext[];
     canonFacts: string[];
     styleGuidelines: string[];
     guardrails: string[];
   }
   
   export interface GenerateRequest {
     sceneId: string & tags.Format<"uuid">;
     action: 'WRITE' | 'REWRITE' | 'DESCRIBE';
     modelProfileId: string & tags.Format<"uuid">;
     stream?: boolean & tags.Default<true>;
     promptOverride?: PromptObject;
   }
   
   export interface RenamePreviewRequest {
     projectId: string & tags.Format<"uuid">;
     from: string & tags.MinLength<1>;
     to: string & tags.MinLength<1>;
     includeAliases?: boolean & tags.Default<true>;
   }
   
   export interface RenamePreviewResponse {
     changes: RenameChange[];
   }
   
   export interface RenameChange {
     sceneId: string;
     before: string;
     after: string;
   }
   ```

6. **Create WebSocket types** (`/packages/shared-types/src/websocket.ts`):
   ```typescript
   // Based on WebSocket Events in spec-pack.md
   
   export interface ClientHello {
     userId: string;
     projectId: string;
     sceneId: string;
     e2ee: boolean;
     token: string;
   }
   
   export interface ServerReady {
     sessionId: string;
     capabilities: ('presence' | 'crdt' | 'stream' | 'cost')[];
   }
   
   export interface PresenceUpdate {
     userId: string;
     cursor: { from: number; to: number };
     color: string;
   }
   
   export interface EditorUpdate {
     sceneId: string;
     ydocUpdateBase64: string;
   }
   
   export interface CommentNew {
     id: string;
     sceneId: string;
     author: string;
     text: string;
     range?: any;
   }
   
   export interface RunDelta {
     runId: string;
     chunk: string;
     index: number;
   }
   
   export interface CostUpdate {
     projectId: string;
     spentUSD: number;
     remainingUSD: number;
   }
   ```

7. **Create context types** (`/packages/shared-types/src/context.ts`):
   ```typescript
   export interface SceneContext {
     sceneId: string & tags.Format<"uuid">;
     title?: string;
     content: string;
     summary?: string;
     entities: string[];
     wordCount: number & tags.Type<"uint32">;
   }
   
   export interface ContextOptions {
     sceneId: string;
     windowSize: number;
     includeSpoilers: boolean;
     maxTokens: number;
   }
   
   export interface CanonFactWithGating {
     fact: string;
     entityId: string;
     revealState: 'PLANNED' | 'REVEALED' | 'REDACTED_UNTIL_SCENE' | 'REDACTED_UNTIL_DATE';
     included: boolean;
     reason?: string;
   }
   ```

8. **Create AI types** (`/packages/shared-types/src/ai.ts`):
   ```typescript
   export interface ProviderAdapter {
     generate(prompt: string, options?: GenerateOptions): Promise<string>;
     generateStream?(prompt: string, options?: GenerateOptions): AsyncIterator<string>;
     embed?(texts: string[]): Promise<number[][]>;
     moderate?(text: string): Promise<boolean>;
   }
   
   export interface GenerateOptions {
     temperature?: number;
     maxTokens?: number;
     topP?: number;
     stopSequences?: string[];
   }
   
   export interface ModelConfig {
     provider: 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'lmstudio';
     model: string;
     apiKey?: string;
     baseUrl?: string;
     defaultOptions?: GenerateOptions;
   }
   ```

9. **Create refactor types** (`/packages/shared-types/src/refactor.ts`):
   ```typescript
   export interface PatchProposal {
     id: string;
     sceneId: string;
     summary: string;
     confidence: number;
     hunks: HunkProposal[];
   }
   
   export interface HunkProposal {
     op: 'REPLACE' | 'INSERT' | 'DELETE';
     origStart: number;
     origEnd: number;
     newText: string;
     anchors: {
       before?: string;
       after?: string;
       yjs?: any;
     };
   }
   
   export interface RefactorRequest {
     projectId: string;
     scopeType: 'SCENE' | 'CHAPTER' | 'BOOK' | 'PROJECT' | 'CUSTOM';
     scopeId?: string;
     instruction: string;
     dryRun?: boolean;
   }
   ```

10. **Update other packages to use shared types**:
    - Update imports in `/apps/api/src/scenes/dto/`
    - Update `/packages/context/src/types.ts` to import from shared
    - Update `/packages/ai-adapters/src/index.ts` to use shared interfaces

## Testing Requirements

1. **Type compilation test**:
   ```bash
   cd packages/shared-types
   pnpm typecheck
   ```

2. **Import test** - Create test file to verify imports work:
   ```typescript
   // packages/shared-types/test/imports.test.ts
   import { ComposeContextRequest, ProviderAdapter } from '../src';
   
   // Should compile without errors
   ```

3. **Cross-package test** - Verify other packages can import:
   - Update one DTO in API to use shared type
   - Verify API still compiles

## Files to Modify/Create
- `/packages/shared-types/package.json` - Create new
- `/packages/shared-types/tsconfig.json` - Create new
- `/packages/shared-types/src/index.ts` - Create new
- `/packages/shared-types/src/api.ts` - Create new
- `/packages/shared-types/src/websocket.ts` - Create new
- `/packages/shared-types/src/context.ts` - Create new
- `/packages/shared-types/src/ai.ts` - Create new
- `/packages/shared-types/src/refactor.ts` - Create new

## Validation Commands
```bash
# From project root
cd packages/shared-types

# Install dependencies
pnpm install

# Check types compile
pnpm typecheck

# Verify package is in workspace
cd ../..
pnpm ls @nelo/shared-types

# Test importing in API
cd apps/api
pnpm typecheck
```

## Notes
- This package should have NO runtime code, only type definitions
- All types should match the spec-pack.md exactly
- This will be imported by most other packages
- Keep types organized by domain (api, websocket, context, etc.)