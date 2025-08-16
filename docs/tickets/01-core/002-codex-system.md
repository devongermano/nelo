# Ticket: 01-core/002 - Codex System

## Priority
**Critical** - Story bible is essential for managing characters and world-building

## Spec Reference
`/docs/spec-pack.md` sections:
- Entity model (lines 384-391)
- CanonFact model (lines 393-401)
- Story Bible (Codex) description (lines 204-211)

## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/001 (Database Schema Update)
- 00-structural/002 (Shared Types Package)

## Current State
- Basic Entity model exists but lacks fields
- CanonFact model incomplete
- No API endpoints for entity management
- No reveal gate functionality

## Target State
- Complete CRUD for Entities (Character, Location, Item, Organization)
- Canon Facts with reveal gates working
- Entity tagging for scenes
- Search and filter capabilities

## Acceptance Criteria
- [ ] Entity CRUD endpoints working
- [ ] Canon Facts support all reveal states
- [ ] Entity types properly categorized
- [ ] Aliases and traits stored as arrays
- [ ] Scene-Entity relationships work
- [ ] Search entities by name/alias
- [ ] Tests cover all functionality

## ⚠️ CRITICAL FIXES REQUIRED

### Major Issues Fixed in This Version:
1. **FATAL BUG**: Original code tried to parse UUID as integer (line 126) - would crash
2. **Performance**: Added Redis caching for entity lookups
3. **Bulk Operations**: Added batch create/update for entities
4. **Async Handling**: Properly handle async operations in filters

## Implementation Steps

1. **Create Entity DTOs** (`/apps/api/src/codex/dto/`):
   ```typescript
   import { tags } from 'typia';
   
   export interface CreateEntityDto {
     name: string & tags.MinLength<1> & tags.MaxLength<200>;
     type: 'CHARACTER' | 'LOCATION' | 'ITEM' | 'ORGANIZATION';
     aliases?: Array<string & tags.MinLength<1>>;
     traits?: string[];
     projectId: string & tags.Format<"uuid">;
   }
   
   export interface CreateCanonFactDto {
     entityId: string & tags.Format<"uuid">;
     fact: string & tags.MinLength<1> & tags.MaxLength<1000>;
     revealState: 'PLANNED' | 'REVEALED' | 'REDACTED_UNTIL_SCENE' | 'REDACTED_UNTIL_DATE';
     revealSceneId?: string & tags.Format<"uuid">;
     revealAt?: string & tags.Format<"date-time">;
     confidence?: number & tags.Type<"uint32"> & tags.Minimum<0> & tags.Maximum<100> & tags.Default<100>;
   }
   ```

2. **Create Codex Service** (`/apps/api/src/codex/codex.service.ts`):
   ```typescript
   @Injectable()
   export class CodexService {
     async createEntity(dto: CreateEntityDto) {
       return prisma.entity.create({
         data: {
           ...dto,
           aliases: dto.aliases || [],
           traits: dto.traits || []
         }
       });
     }
     
     async searchEntities(projectId: string, query: string) {
       return prisma.entity.findMany({
         where: {
           projectId,
           OR: [
             { name: { contains: query, mode: 'insensitive' } },
             { aliases: { has: query } }
           ]
         },
         include: {
           facts: true,
           _count: { select: { scenes: true } }
         }
       });
     }
     
     async createCanonFact(dto: CreateCanonFactDto) {
       return prisma.canonFact.create({
         data: {
           ...dto,
           confidence: dto.confidence || 100
         }
       });
     }
     
     async getFactsForScene(sceneId: string, includeHidden = false) {
       const scene = await prisma.scene.findUnique({
         where: { id: sceneId },
         include: {
           entities: {
             include: {
               entity: {
                 include: { facts: true }
               }
             }
           }
         }
       });
       
       if (!scene) throw new NotFoundException();
       
       const facts = scene.entities.flatMap(se => 
         se.entity.facts.filter(fact => {
           if (includeHidden) return true;
           
           switch (fact.revealState) {
             case 'REVEALED':
               return true;
             case 'REDACTED_UNTIL_SCENE':
               // ⚠️ CRITICAL BUG FIXED: Cannot parse UUID as integer!
               // Must lookup scene index for comparison
               return false; // See getFactsForSceneOptimized below for proper implementation
             case 'REDACTED_UNTIL_DATE':
               return fact.revealAt && new Date() >= fact.revealAt;
             default:
               return false;
           }
         })
       );
       
       return facts;
     }
     
     async tagSceneEntity(sceneId: string, entityId: string) {
       return prisma.sceneEntity.create({
         data: { sceneId, entityId }
       });
     }
   }
   
   // OPTIMIZED VERSION with proper async handling and caching
   async getFactsForSceneOptimized(sceneId: string, includeHidden = false) {
     // Check cache first
     const cacheKey = `facts:${sceneId}:${includeHidden}`;
     const cached = await this.redis.get(cacheKey);
     if (cached) return JSON.parse(cached);
     
     const scene = await prisma.scene.findUnique({
       where: { id: sceneId },
       include: {
         entities: {
           include: {
             entity: {
               include: { facts: true }
             }
           }
         }
       }
     });
     
     if (!scene) throw new NotFoundException();
     
     // Pre-fetch all reveal scenes for efficiency
     const revealSceneIds = [...new Set(
       scene.entities.flatMap(se => 
         se.entity.facts
           .filter(f => f.revealState === 'REDACTED_UNTIL_SCENE' && f.revealSceneId)
           .map(f => f.revealSceneId)
       )
     )];
     
     const revealScenes = await prisma.scene.findMany({
       where: { id: { in: revealSceneIds } },
       select: { id: true, index: true }
     });
     
     const revealSceneMap = new Map(revealScenes.map(s => [s.id, s.index]));
     
     const facts = scene.entities.flatMap(se => 
       se.entity.facts.filter(fact => {
         if (includeHidden) return true;
         
         switch (fact.revealState) {
           case 'REVEALED':
             return true;
           case 'REDACTED_UNTIL_SCENE':
             if (!fact.revealSceneId) return false;
             const revealIndex = revealSceneMap.get(fact.revealSceneId);
             return revealIndex !== undefined && scene.index >= revealIndex;
           case 'REDACTED_UNTIL_DATE':
             return fact.revealAt && new Date() >= fact.revealAt;
           default:
             return false;
         }
       })
     );
     
     // Cache for 5 minutes
     await this.redis.setex(cacheKey, 300, JSON.stringify(facts));
     
     return facts;
   }
   
   // Bulk operations for efficiency
   async bulkCreateEntities(entities: CreateEntityDto[]) {
     return prisma.$transaction(
       entities.map(entity => 
         prisma.entity.create({
           data: {
             ...entity,
             aliases: entity.aliases || [],
             traits: entity.traits || []
           }
         })
       )
     );
   }
   
   // Cache invalidation
   async invalidateEntityCache(projectId: string) {
     const keys = await this.redis.keys(`facts:*`);
     if (keys.length > 0) {
       await this.redis.del(...keys);
     }
   }
   ```

3. **Create Codex Controller** (`/apps/api/src/codex/codex.controller.ts`):
   ```typescript
   import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
   
   @Controller('codex')
   export class CodexController {
     constructor(private codexService: CodexService) {}
     
     @TypedRoute.Post('entities')
     async createEntity(@TypedBody() dto: CreateEntityDto) {
       return this.codexService.createEntity(dto);
     }
     
     @Get('entities')
     async searchEntities(
       @Query('projectId') projectId: string,
       @Query('q') query: string
     ) {
       return this.codexService.searchEntities(projectId, query);
     }
     
     @Get('entities/:id')
     async getEntity(@Param('id') id: string) {
       return prisma.entity.findUnique({
         where: { id },
         include: { facts: true }
       });
     }
     
     @TypedRoute.Post('facts')
     async createFact(@TypedBody() dto: CreateCanonFactDto) {
       return this.codexService.createCanonFact(dto);
     }
     
     @Get('scenes/:sceneId/facts')
     async getSceneFacts(
       @Param('sceneId') sceneId: string,
       @Query('includeHidden') includeHidden?: boolean
     ) {
       return this.codexService.getFactsForScene(sceneId, includeHidden);
     }
     
     @Post('scenes/:sceneId/entities/:entityId')
     async tagEntity(
       @Param('sceneId') sceneId: string,
       @Param('entityId') entityId: string
     ) {
       return this.codexService.tagSceneEntity(sceneId, entityId);
     }
   }
   ```

4. **Create Codex Module** (`/apps/api/src/codex/codex.module.ts`):
   ```typescript
   @Module({
     controllers: [CodexController],
     providers: [CodexService],
     exports: [CodexService]
   })
   export class CodexModule {}
   ```

## Testing Requirements
- Test entity creation with aliases/traits
- Test canon fact reveal states
- Test scene-entity tagging
- Test fact filtering by reveal conditions
- Test entity search functionality

## Files to Modify/Create
- `/apps/api/src/codex/` - New module directory
- `/apps/api/src/codex/dto/` - DTOs
- `/apps/api/src/codex/codex.service.ts`
- `/apps/api/src/codex/codex.controller.ts`
- `/apps/api/src/codex/codex.module.ts`
- `/apps/api/src/app.module.ts` - Import CodexModule
- Test files

## Validation Commands
```bash
cd apps/api
pnpm test
pnpm typecheck

# Test entity creation
curl -X POST http://localhost:3001/codex/entities \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","type":"CHARACTER","aliases":["Ali"],"projectId":"123"}'
```

## Notes
- Reveal gates are critical for spoiler prevention
- This forms the foundation for context composition
- Consider adding entity relationship tracking in future