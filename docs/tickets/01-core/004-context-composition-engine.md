# Ticket: 01-core/004 - Context Composition Engine

## Priority
**Critical** - Required for AI generation with story context

## Spec Reference
`/docs/spec-pack.md` sections:
- Section 8: Context Builder Algorithm (lines 853-880)
- ComposeContextRequest/Response (lines 629-647)

## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/003 (Consolidate Context Packages)
- 01-core/002 (Codex System)

## Current State
- Basic compose function in context-engine
- No real implementation of algorithm
- No token budgeting
- No retrieval/ranking

## Target State
- Full context composition per spec
- Spoiler-safe canon fact filtering
- Token budgeting with truncation
- Scene window selection
- Embedding-based retrieval

## Acceptance Criteria
- [ ] Context includes previous scene summaries
- [ ] Canon facts filtered by reveal state
- [ ] Token count estimation works
- [ ] Redactions tracked and returned
- [ ] Style guidelines included
- [ ] Tests cover all reveal scenarios

## ✨ Major Improvements

### Critical Fixes in This Version:
1. **Accurate Token Counting**: Using tiktoken instead of length/4
2. **Semantic Search**: Proper embeddings with pgvector
3. **Caching Strategy**: Redis cache for composed contexts
4. **Scene Window**: Respects chapter boundaries
5. **Context Strategies**: Different approaches for WRITE vs REWRITE

## Implementation Steps

1. **Enhance context composition** (`/packages/context-engine/src/compose.ts`):
   ```typescript
   import { Scene, Entity, CanonFact, StyleGuide } from '@nelo/db';
   import { ComposeContextOptions, ComposeContextResult } from '@nelo/shared-types';
   
   export class ContextComposer {
     private redis: Redis;
     
     constructor() {
       this.redis = new Redis(process.env.REDIS_URL);
     }
     
     async composeContext(options: ComposeContextOptions): Promise<ComposeContextResult> {
       // Check cache first
       const cacheKey = this.getCacheKey(options);
       const cached = await this.redis.get(cacheKey);
       
       if (cached && !options.skipCache) {
         return JSON.parse(cached);
       }
       // 1. Selection - get scene window
       const sceneContext = await this.buildSceneContext(options);
       
       // 2. Canon gating - filter facts
       const { facts, redactions } = await this.filterCanonFacts(options);
       
       // 3. Retrieval & ranking
       const rankedContent = await this.rankContent(options);
       
       // 4. Budgeting - truncate to token limit
       const budgeted = await this.applyTokenBudget(
         { sceneContext, facts, rankedContent },
         options.maxTokens
       );
       
       // 5. Build prompt object
       const promptObject = {
         system: this.buildSystemPrompt(options),
         instructions: this.buildInstructions(options),
         sceneContext: budgeted.sceneContext,
         canonFacts: budgeted.facts,
         styleGuidelines: await this.getStyleGuidelines(options),
         guardrails: this.buildGuardrails()
       };
       
       const tokenEstimate = this.estimateTokens(promptObject);
       
       const result = { promptObject, redactions, tokenEstimate };
       
       // Cache the result for 5 minutes
       if (!options.skipCache) {
         await this.redis.setex(cacheKey, 300, JSON.stringify(result));
       }
       
       return result;
     }
     
     private getCacheKey(options: ComposeContextOptions): string {
       // Create deterministic cache key
       const components = [
         'context',
         options.scene.id,
         options.windowScenes || 3,
         options.includeSpoilersForAuthorTools ? 'spoilers' : 'nospoilers',
         options.maxTokens || 2000,
         options.contextStrategy || 'default'
       ];
       return components.join(':');
     }
     
     private async buildSceneContext(options: ComposeContextOptions) {
       // IMPROVED: Consider chapter boundaries and scene continuity
       const currentChapter = await prisma.chapter.findUnique({
         where: { id: options.scene.chapterId },
         include: { book: true }
       });
       
       // Get scenes from current chapter first
       const currentChapterScenes = await prisma.scene.findMany({
         where: {
           chapterId: options.scene.chapterId,
           index: { lt: options.scene.index }
         },
         orderBy: { index: 'desc' },
         take: options.windowScenes || 3,
         select: { id: true, summary: true, title: true, wordCount: true }
       });
       
       let scenes = currentChapterScenes;
       
       // If we need more context and have room, get from previous chapter
       if (scenes.length < (options.windowScenes || 3)) {
         const previousChapter = await prisma.chapter.findFirst({
           where: {
             bookId: currentChapter?.bookId,
             index: { lt: currentChapter?.index || 0 }
           },
           orderBy: { index: 'desc' }
         });
         
         if (previousChapter) {
           const previousScenes = await prisma.scene.findMany({
             where: { chapterId: previousChapter.id },
             orderBy: { index: 'desc' },
             take: (options.windowScenes || 3) - scenes.length,
             select: { id: true, summary: true, title: true, wordCount: true }
           });
           scenes = [...previousScenes, ...scenes];
         }
       }
       
       return scenes.reverse().map(s => ({
         sceneId: s.id,
         title: s.title,
         summary: s.summary || 'No summary available'
       }));
     }
     
     private async filterCanonFacts(options: ComposeContextOptions) {
       const facts = await prisma.canonFact.findMany({
         where: {
           entity: {
             scenes: {
               some: { sceneId: options.scene.id }
             }
           }
         },
         include: { entity: true }
       });
       
       const filtered = [];
       const redactions = [];
       
       for (const fact of facts) {
         const { included, reason } = this.shouldIncludeFact(
           fact,
           options.scene,
           options.includeSpoilersForAuthorTools
         );
         
         if (included) {
           filtered.push(fact.fact);
         } else if (reason) {
           redactions.push({ factId: fact.id, reason });
         }
       }
       
       return { facts: filtered, redactions };
     }
     
     private shouldIncludeFact(
       fact: CanonFact,
       scene: Scene,
       includeSpoilers: boolean
     ) {
       if (includeSpoilers) {
         return { included: true };
       }
       
       switch (fact.revealState) {
         case 'REVEALED':
           return { included: true };
           
         case 'REDACTED_UNTIL_SCENE':
           if (fact.revealSceneId && scene.index >= parseInt(fact.revealSceneId)) {
             return { included: true };
           }
           return {
             included: false,
             reason: `Hidden until scene ${fact.revealSceneId}`
           };
           
         case 'REDACTED_UNTIL_DATE':
           if (fact.revealAt && new Date() >= fact.revealAt) {
             return { included: true };
           }
           return {
             included: false,
             reason: `Hidden until ${fact.revealAt}`
           };
           
         case 'PLANNED':
           return {
             included: false,
             reason: 'Planned but not yet revealed'
           };
           
         default:
           return { included: false };
       }
     }
     
     private async rankContent(options: ComposeContextOptions) {
       // ENHANCED: Proper semantic search with embeddings
       const sceneEmbedding = await this.getSceneEmbedding(options.scene.id);
       
       if (!sceneEmbedding) {
         // Fallback to keyword-based ranking
         return this.fallbackRanking(options);
       }
       
       // Get all relevant entities with their embeddings
       const entities = await prisma.$queryRaw`
         SELECT e.*, 
                e.embedding <-> ${sceneEmbedding}::vector AS distance
         FROM "Entity" e
         INNER JOIN "SceneEntity" se ON se."entityId" = e.id
         WHERE se."sceneId" = ${options.scene.id}
         ORDER BY distance
         LIMIT 20
       `;
       
       // Get related scenes by semantic similarity
       const relatedScenes = await prisma.$queryRaw`
         SELECT s.id, s.summary, s.title,
                s.embedding <-> ${sceneEmbedding}::vector AS distance
         FROM "Scene" s
         WHERE s."projectId" = ${options.scene.projectId}
           AND s.id != ${options.scene.id}
           AND s.embedding IS NOT NULL
         ORDER BY distance
         LIMIT 10
       `;
       
       // Combine and rank
       const rankedContent = [
         ...entities.map(e => ({
           type: 'entity' as const,
           content: `${e.name}: ${e.traits?.join(', ') || 'No traits'}`,
           score: 1 - (e.distance || 0) // Convert distance to similarity
         })),
         ...relatedScenes.map(s => ({
           type: 'scene' as const,
           content: `Related scene: ${s.title}\n${s.summary}`,
           score: 1 - (s.distance || 0)
         }))
       ];
       
       // Sort by score and return top items
       return rankedContent
         .sort((a, b) => b.score - a.score)
         .slice(0, options.maxRankedItems || 15);
     }
     
     private async getSceneEmbedding(sceneId: string) {
       const scene = await prisma.scene.findUnique({
         where: { id: sceneId },
         select: { embedding: true }
       });
       return scene?.embedding;
     }
     
     private async fallbackRanking(options: ComposeContextOptions) {
       // Keyword-based fallback when embeddings not available
       const entities = await prisma.entity.findMany({
         where: {
           scenes: {
             some: { sceneId: options.scene.id }
           }
         }
       });
       
       return entities.map(e => ({
         type: 'entity' as const,
         content: `${e.name}: ${e.traits?.join(', ') || ''}`,
         score: 1.0 // Default score for fallback
       }));
     }
     
     private async applyTokenBudget(content: any, maxTokens: number) {
       // Simplified token counting
       const estimate = this.estimateTokens(content);
       
       if (estimate <= maxTokens) {
         return content;
       }
       
       // Truncate least important content
       // Priority: current scene > facts > previous scenes
       return content;
     }
     
     // CRITICAL FIX: Proper token counting per model
     private estimateTokens(obj: any, model: string = 'gpt-4'): number {
       const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
       
       // Use proper tokenizer based on model
       if (model.startsWith('gpt-') || model.startsWith('text-')) {
         return this.countOpenAITokens(text, model);
       } else if (model.startsWith('claude-')) {
         return this.countAnthropicTokens(text);
       } else {
         // Fallback to approximation for unknown models
         // More accurate than /4: accounts for punctuation and whitespace
         return Math.ceil(text.split(/\s+|\b/).length * 1.3);
       }
     }
     
     private countOpenAITokens(text: string, model: string): number {
       // In production, use tiktoken
       try {
         const tiktoken = require('tiktoken');
         const encoder = tiktoken.encoding_for_model(model);
         const tokens = encoder.encode(text);
         encoder.free(); // Important: free memory
         return tokens.length;
       } catch {
         // Fallback if tiktoken not available
         return Math.ceil(text.length / 3.5); // More accurate average
       }
     }
     
     private countAnthropicTokens(text: string): number {
       // Anthropic uses similar tokenization to GPT
       // Slightly different ratios
       return Math.ceil(text.length / 3.8);
     }
   }
   ```

2. **Create context controller** (`/apps/api/src/context/context.controller.ts`):
   ```typescript
   @Controller('context')
   export class ContextController {
     constructor(private composer: ContextComposer) {}
     
     @Post('compose')
     async composeContext(@Body() dto: ComposeContextRequestDto) {
       const scene = await prisma.scene.findUnique({
         where: { id: dto.sceneId }
       });
       
       if (!scene) throw new NotFoundException();
       
       return this.composer.composeContext({
         scene,
         windowScenes: dto.windowScenes || 3,
         includeSpoilersForAuthorTools: dto.includeSpoilersForAuthorTools || false,
         maxTokens: dto.maxTokens || 2000
       });
     }
   }
   ```

## Testing Requirements
- Test reveal state filtering for all states
- Test token budgeting
- Test scene window selection
- Test redaction tracking
- Test with/without spoilers flag

## Files to Modify/Create
- `/packages/context-engine/src/compose.ts` - Full implementation
- `/packages/context-engine/src/ranking.ts` - Content ranking
- `/packages/context-engine/src/tokenizer.ts` - Token counting
- `/apps/api/src/context/context.controller.ts` - API endpoint
- Test files

## Validation Commands
```bash
cd packages/context-engine
pnpm test

cd ../../apps/api
pnpm test context
```

## Notes
- This is the core of spoiler-safe AI generation
- Token budgeting critical for cost control
- Consider caching composed contexts