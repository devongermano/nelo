# Ticket: 00-structural/003 - Consolidate Context Packages

## Priority
**High** - Removes confusion and consolidates context logic in one place

## Spec Reference
`/docs/spec-pack.md` sections:
- Section 8: Context Builder Algorithm (lines 853-880)
- Section 8.1: Refactor Chat Algorithm (lines 882-907)

## Dependencies
- 00-structural/000 (Complete Typia Setup) - Need Typia for validation

## Current State
- Two context-related packages exist:
  - `/packages/context/` - Has basic types using Zod (to be replaced with Typia)
  - `/packages/context-engine/` - Has a different compose implementation
- This creates confusion about which to use
- Logic is split unnecessarily
- Both have incomplete implementations

## Target State
- Single `/packages/context-engine/` package with all context logic
- Clear, comprehensive context composition implementation
- Types imported from `@nelo/shared-types` (once available)
- Old `/packages/context/` package removed
- All validation using Typia

## Acceptance Criteria
- [ ] All logic consolidated in `/packages/context-engine/`
- [ ] Package exports complete context composition functions
- [ ] Old `/packages/context/` directory removed
- [ ] All imports updated to use `@nelo/context-engine`
- [ ] Tests consolidated and passing
- [ ] No breaking changes to API

## Implementation Steps

1. **Analyze both packages** to understand what to keep:
   - `/packages/context/` has: basic types, simple compose function
   - `/packages/context-engine/` has: canon fact filtering logic
   - Merge the best of both

2. **Update context-engine package.json**:
   ```json
   {
     "name": "@nelo/context-engine",
     "version": "0.0.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "test": "vitest",
       "typecheck": "tsc --noEmit"
     },
     "dependencies": {
       "@nelo/db": "workspace:*",
       "@nelo/shared-types": "workspace:*",
       "typia": "^6.0.0",
       "gpt-tokenizer": "^2.1.2"
     },
     "devDependencies": {
       "typescript": "^5.3.0",
       "vitest": "^0.34.0"
     }
   }
   ```

3. **Merge and enhance the compose function** (`/packages/context-engine/src/compose.ts`):
   ```typescript
   import { Scene, Entity, CanonFact } from '@nelo/db';
   import { tags } from 'typia';
   import typia from 'typia';
   
   export interface ComposeContextOptions {
     scene: Scene;
     windowScenes: number & tags.Minimum<1> & tags.Maximum<10>;
     includeSpoilersForAuthorTools: boolean;
     maxTokens: number & tags.Type<"uint32"> & tags.Minimum<100> & tags.Maximum<100000>;
     entities: Entity[];
     canonFacts: CanonFact[];
     previousScenes?: Scene[];
   }
   
   export const validateComposeOptions = typia.createValidate<ComposeContextOptions>();
   
   export interface ComposeContextResult {
     promptObject: {
       system: string;
       instructions: string;
       sceneContext: any[];
       canonFacts: string[];
       styleGuidelines: string[];
       guardrails: string[];
     };
     redactions: Array<{
       factId: string;
       reason: string;
     }>;
     tokenEstimate: number;
   }
   
   export function composeContext(options: ComposeContextOptions): ComposeContextResult {
     const { scene, canonFacts, includeSpoilersForAuthorTools } = options;
     const redactions: any[] = [];
     
     // Filter canon facts based on reveal state
     const filteredFacts = canonFacts.filter(fact => {
       // Include if revealed
       if (fact.revealState === 'REVEALED') return true;
       
       // Check scene-based reveals
       if (fact.revealState === 'REDACTED_UNTIL_SCENE' && fact.revealSceneId) {
         const revealed = fact.revealSceneId <= scene.id;
         if (!revealed && !includeSpoilersForAuthorTools) {
           redactions.push({
             factId: fact.id,
             reason: `Hidden until scene ${fact.revealSceneId}`
           });
         }
         return revealed || includeSpoilersForAuthorTools;
       }
       
       // Check date-based reveals
       if (fact.revealState === 'REDACTED_UNTIL_DATE' && fact.revealAt) {
         const revealed = new Date() >= fact.revealAt;
         if (!revealed && !includeSpoilersForAuthorTools) {
           redactions.push({
             factId: fact.id,
             reason: `Hidden until ${fact.revealAt}`
           });
         }
         return revealed || includeSpoilersForAuthorTools;
       }
       
       // Planned facts
       if (fact.revealState === 'PLANNED') {
         if (!includeSpoilersForAuthorTools) {
           redactions.push({
             factId: fact.id,
             reason: 'Planned but not revealed'
           });
         }
         return includeSpoilersForAuthorTools;
       }
       
       return false;
     });
     
     // Build prompt object
     const promptObject = {
       system: 'You are a creative writing assistant.',
       instructions: buildInstructions(scene),
       sceneContext: buildSceneContext(options),
       canonFacts: filteredFacts.map(f => f.fact),
       styleGuidelines: [],
       guardrails: []
     };
     
     // Estimate tokens (simplified)
     const tokenEstimate = estimateTokens(promptObject);
     
     return {
       promptObject,
       redactions,
       tokenEstimate
     };
   }
   
   function buildInstructions(scene: Scene): string {
     let instructions = '';
     if (scene.pov) instructions += `POV: ${scene.pov}\\n`;
     if (scene.tense) instructions += `Tense: ${scene.tense}\\n`;
     return instructions;
   }
   
   function buildSceneContext(options: ComposeContextOptions): any[] {
     const context = [];
     
     // Add previous scene summaries
     if (options.previousScenes) {
       options.previousScenes.slice(-options.windowScenes).forEach(s => {
         context.push({
           sceneId: s.id,
           summary: s.summary || 'No summary available'
         });
       });
     }
     
     // Add current scene
     context.push({
       sceneId: options.scene.id,
       content: options.scene.contentMd || options.scene.content || ''
     });
     
     return context;
   }
   
   function estimateTokens(promptObject: any): number {
     // Rough estimation: 1 token ≈ 4 characters
     const text = JSON.stringify(promptObject);
     return Math.ceil(text.length / 4);
   }
   ```

4. **Update the main export** (`/packages/context-engine/src/index.ts`):
   ```typescript
   export { composeContext } from './compose';
   export type { ComposeContextOptions, ComposeContextResult } from './compose';
   
   // Keep backward compatibility if needed
   export { composeContext as default } from './compose';
   ```

5. **Consolidate tests** from both packages:
   - Move `/packages/context/test/context.spec.ts` content
   - Merge with `/packages/context-engine/test/compose-context.test.ts`
   - Add new tests for spoiler gating

6. **Update imports in API**:
   ```typescript
   // /apps/api/src/context/context.service.ts
   import { composeContext, ComposeContextOptions } from '@nelo/context-engine';
   ```

7. **Remove old package**:
   ```bash
   # After verifying everything works
   rm -rf packages/context
   ```

8. **Update workspace dependencies**:
   - Remove `@nelo/context` from any package.json files
   - Ensure `@nelo/context-engine` is used instead

## Testing Requirements

1. **Unit tests** for context composition (`/packages/context-engine/test/compose.test.ts`):
   - Test reveal state filtering (all states)
   - Test spoiler redaction
   - Test includeSpoilersForAuthorTools flag
   - Test token estimation
   - Test scene window selection

2. **Integration test** with API:
   - Verify context service still works
   - Test `/compose-context` endpoint

Example test:
```typescript
describe('composeContext', () => {
  it('should redact unrevealed facts', () => {
    const result = composeContext({
      scene: { id: '10' },
      canonFacts: [{
        id: '1',
        fact: 'Secret villain',
        revealState: 'REDACTED_UNTIL_SCENE',
        revealSceneId: '20'
      }],
      includeSpoilersForAuthorTools: false
    });
    
    expect(result.redactions).toHaveLength(1);
    expect(result.canonFacts).toHaveLength(0);
  });
});
```

## Files to Modify/Create
- `/packages/context-engine/src/compose.ts` - Enhanced compose function
- `/packages/context-engine/src/index.ts` - Updated exports
- `/packages/context-engine/test/compose.test.ts` - Consolidated tests
- `/apps/api/src/context/context.service.ts` - Update imports
- Remove: `/packages/context/` entire directory

## Validation Commands
```bash
# From project root
cd packages/context-engine

# Run tests
pnpm test

# Check types
pnpm typecheck

# Verify API still works
cd ../../apps/api
pnpm typecheck
pnpm test

# Verify old package is gone
ls ../context  # Should fail

# Check no references remain
grep -r "@nelo/context" . --exclude-dir=node_modules
```

## Notes
- Keep backward compatibility where possible
- The consolidated package should be the single source of truth for context logic
- Future context-related features should be added here
- This sets the foundation for the Context Composition Engine ticket (01-core/004)