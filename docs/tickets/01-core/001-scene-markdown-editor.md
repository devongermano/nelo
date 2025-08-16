# Ticket: 01-core/001 - Scene Markdown Editor

## Priority
**Critical** - Core feature for manuscript writing

## Spec Reference
`/docs/spec-pack.md` sections:
- Document format: "Each Scene stores Markdown (canonical)" (line 30)
- Scene model fields (lines 333-343)
- Snapshot model (lines 345-353)

## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/001 (Database Schema Update)
- 00-structural/002 (Shared Types Package)

## Current State
- Scene has plain text `content` field
- No Markdown support
- No snapshots on save
- No word count tracking
- Missing title, summary fields

## Target State
- Scene stores Markdown in `contentMd` field
- Automatic snapshots on significant changes
- Word count calculated and stored
- Summary field for scene overview
- Proper DTOs for Markdown content

## Acceptance Criteria
- [ ] Scene CRUD handles `contentMd` field properly
- [ ] Snapshots created on scene updates
- [ ] Word count automatically calculated
- [ ] Scene summary can be set/updated
- [ ] API returns Markdown content correctly
- [ ] Version increments on updates
- [ ] Tests cover all new functionality

## Implementation Steps

1. **Update Scene DTOs** (`/apps/api/src/scenes/dto/`):

   Create `update-scene-content.dto.ts`:
   ```typescript
   import { tags } from 'typia';
   
   export interface UpdateSceneContentDto {
     contentMd?: string & tags.MaxLength<100000>;
     summary?: string & tags.MaxLength<500>;
     title?: string & tags.MaxLength<200>;
     index?: number & tags.Type<"uint32"> & tags.Minimum<0>;
     status?: 'draft' | 'revised' | 'final';
     pov?: string;
     tense?: string;
   }
   ```

   Update `create-scene.dto.ts`:
   ```typescript
   import { tags } from 'typia';
   
   export interface CreateSceneDto {
     chapterId: string & tags.Format<"uuid">;
     projectId: string & tags.Format<"uuid">;
     title: string & tags.MinLength<1> & tags.MaxLength<200>;
     contentMd?: string & tags.MaxLength<100000>;
     summary?: string & tags.MaxLength<500>;
     index?: number & tags.Type<"uint32">;
     status?: ('draft' | 'revised' | 'final') & tags.Default<"draft">;
   }
   ```

2. **Add word count utility** (`/apps/api/src/scenes/utils/word-count.ts`):
   ```typescript
   export function calculateWordCount(markdown: string): number {
     if (!markdown) return 0;
     
     // Remove markdown syntax for accurate count
     const text = markdown
       .replace(/```[\s\S]*?```/g, '') // Remove code blocks
       .replace(/`.*?`/g, '') // Remove inline code
       .replace(/#+\s/g, '') // Remove headers
       .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
       .replace(/[*_~]/g, '') // Remove emphasis markers
       .replace(/^[-*+]\s/gm, '') // Remove list markers
       .replace(/^\d+\.\s/gm, '') // Remove numbered list markers
       .replace(/^>\s/gm, '') // Remove blockquotes
       .trim();
     
     // Split by whitespace and filter empty strings
     const words = text.split(/\s+/).filter(word => word.length > 0);
     return words.length;
   }
   ```

3. **Create snapshot service** (`/apps/api/src/scenes/snapshot.service.ts`):
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { prisma } from '@nelo/db';
   
   @Injectable()
   export class SnapshotService {
     async createSnapshot(sceneId: string, contentMd: string, version: number): Promise<void> {
       await prisma.snapshot.create({
         data: {
           sceneId,
           contentMd,
           version
         }
       });
     }
     
     async shouldCreateSnapshot(
       oldContent: string | null,
       newContent: string
     ): boolean {
       if (!oldContent) return true; // First content
       
       // IMPROVED: Semantic diff-based snapshot decision
       const oldWords = this.extractWords(oldContent);
       const newWords = this.extractWords(newContent);
       
       // Calculate semantic changes using diff algorithm
       const additions = this.countAdditions(oldContent, newContent);
       const deletions = this.countDeletions(oldContent, newContent);
       const totalChanges = additions + deletions;
       
       // Snapshot if:
       // - >20% content changed (more conservative)
       // - >1000 characters absolute change
       // - Structural changes detected (new headings)
       const structuralChange = this.detectStructuralChanges(oldContent, newContent);
       const changeRatio = totalChanges / Math.max(oldContent.length, newContent.length, 1);
       
       return changeRatio > 0.2 || 
              Math.abs(newContent.length - oldContent.length) > 1000 ||
              structuralChange;
     }
     
     async getSnapshots(sceneId: string, limit: number = 10) {
       return prisma.snapshot.findMany({
         where: { sceneId },
         orderBy: { createdAt: 'desc' },
         take: limit
       });
     }
     
     async restoreSnapshot(sceneId: string, snapshotId: string) {
       const snapshot = await prisma.snapshot.findUnique({
         where: { id: snapshotId }
       });
       
       if (!snapshot || snapshot.sceneId !== sceneId) {
         throw new Error('Snapshot not found or does not belong to scene');
       }
       
       return snapshot;
     }
     
     // Helper methods for improved snapshot logic
     private extractWords(text: string): string[] {
       return text.toLowerCase().match(/\b\w+\b/g) || [];
     }
     
     private countAdditions(oldText: string, newText: string): number {
       // Simple diff - in production use diff-match-patch or similar
       const oldLines = oldText.split('\n');
       const newLines = newText.split('\n');
       let additions = 0;
       
       for (const line of newLines) {
         if (!oldLines.includes(line)) {
           additions += line.length;
         }
       }
       return additions;
     }
     
     private countDeletions(oldText: string, newText: string): number {
       const oldLines = oldText.split('\n');
       const newLines = newText.split('\n');
       let deletions = 0;
       
       for (const line of oldLines) {
         if (!newLines.includes(line)) {
           deletions += line.length;
         }
       }
       return deletions;
     }
     
     private detectStructuralChanges(oldText: string, newText: string): boolean {
       const oldHeadings = oldText.match(/^#{1,3} .+$/gm) || [];
       const newHeadings = newText.match(/^#{1,3} .+$/gm) || [];
       
       return oldHeadings.length !== newHeadings.length ||
              oldHeadings.some((h, i) => h !== newHeadings[i]);
     }
   }
   ```

4. **Update ScenesService** (`/apps/api/src/scenes/scenes.service.ts`):
   ```typescript
   import { calculateWordCount } from './utils/word-count';
   import { SnapshotService } from './snapshot.service';
   
   @Injectable()
   export class ScenesService {
     constructor(private snapshotService: SnapshotService) {}
     
     async create(dto: CreateSceneDto): Promise<Scene> {
       const wordCount = calculateWordCount(dto.contentMd || '');
       
       const scene = await prisma.scene.create({
         data: {
           ...dto,
           contentMd: dto.contentMd || '',
           wordCount,
           version: 1,
           status: dto.status || 'draft',
           // Initialize empty CRDT doc
           docCrdt: {}
         }
       });
       
       // Create initial snapshot if content exists
       if (dto.contentMd) {
         await this.snapshotService.createSnapshot(
           scene.id,
           dto.contentMd,
           scene.version
         );
       }
       
       return scene;
     }
     
     async update(id: string, dto: UpdateSceneContentDto): Promise<Scene> {
       return await prisma.$transaction(async (tx) => {
         const currentScene = await tx.scene.findUnique({
           where: { id }
         });
         
         if (!currentScene) {
           throw new NotFoundException(`Scene ${id} not found`);
         }
         
         // Calculate word count if content changed
         const wordCount = dto.contentMd 
           ? calculateWordCount(dto.contentMd)
           : currentScene.wordCount;
         
         // Check if snapshot needed
         if (dto.contentMd && 
             await this.snapshotService.shouldCreateSnapshot(
               currentScene.contentMd,
               dto.contentMd
             )) {
           await this.snapshotService.createSnapshot(
             id,
             dto.contentMd,
             currentScene.version + 1
           );
         }
         
         // Update scene with version increment
         const updatedScene = await tx.scene.update({
           where: { 
             id,
             version: currentScene.version // Optimistic lock
           },
           data: {
             ...dto,
             wordCount,
             version: { increment: 1 },
             updatedAt: new Date()
           }
         });
         
         return updatedScene;
       });
     }
     
     // ADDED: Proper optimistic locking implementation
     async updateWithOptimisticLock(
       id: string, 
       dto: UpdateSceneContentDto,
       expectedVersion: number
     ): Promise<Scene> {
       return await prisma.$transaction(async (tx) => {
         // This will throw P2025 if version doesn't match
         const updatedScene = await tx.scene.update({
           where: { 
             id,
             version: expectedVersion // Optimistic lock check
           },
           data: {
             ...dto,
             wordCount: dto.contentMd ? calculateWordCount(dto.contentMd) : undefined,
             version: { increment: 1 },
             updatedAt: new Date()
           }
         });
         
         // Create snapshot if needed
         if (dto.contentMd) {
           const currentScene = await tx.scene.findUnique({
             where: { id },
             select: { contentMd: true }
           });
           
           if (await this.snapshotService.shouldCreateSnapshot(
             currentScene?.contentMd || '',
             dto.contentMd
           )) {
             await this.snapshotService.createSnapshot(
               id,
               dto.contentMd,
               updatedScene.version
             );
           }
         }
         
         return updatedScene;
       }, {
         isolationLevel: 'Serializable' // Ensure consistency
       });
     }
     
     async getSceneWithSnapshots(id: string) {
       const scene = await this.getSceneById(id);
       const snapshots = await this.snapshotService.getSnapshots(id);
       
       return {
         ...scene,
         snapshots
       };
     }
   }
   ```

5. **Update ScenesController** (`/apps/api/src/scenes/scenes.controller.ts`):
   ```typescript
   import { TypedBody, TypedParam, TypedRoute } from '@nestia/core';
   
   @Controller('scenes')
   export class ScenesController {
     constructor(
       private readonly scenesService: ScenesService,
       private readonly snapshotService: SnapshotService
     ) {}
     
     @TypedRoute.Post()
     @UseInterceptors(IdempotencyInterceptor)
     async create(@TypedBody() dto: CreateSceneDto) {
       return this.scenesService.create(dto);
     }
     
     @TypedRoute.Patch(':id')
     async update(
       @TypedParam('id', 'uuid') id: string,
       @IfMatchHeader() ifMatch: string,
       @TypedBody() dto: UpdateSceneContentDto
     ) {
       const currentScene = await this.scenesService.find(id);
       if (String(currentScene.version) !== ifMatch) {
         throw new PreconditionFailedException('Version mismatch');
       }
       
       return await this.scenesService.update(id, dto);
     }
     
     @Get(':id')
     async get(@Param('id') id: string) {
       return this.scenesService.getSceneById(id);
     }
     
     @Get(':id/snapshots')
     async getSnapshots(@Param('id') id: string) {
       return this.snapshotService.getSnapshots(id);
     }
     
     @Post(':id/restore/:snapshotId')
     async restoreSnapshot(
       @Param('id') id: string,
       @Param('snapshotId') snapshotId: string
     ) {
       const snapshot = await this.snapshotService.restoreSnapshot(id, snapshotId);
       return this.scenesService.update(id, {
         contentMd: snapshot.contentMd
       });
     }
   }
   ```

6. **Update ScenesModule** (`/apps/api/src/scenes/scenes.module.ts`):
   ```typescript
   import { SnapshotService } from './snapshot.service';
   
   @Module({
     controllers: [ScenesController],
     providers: [ScenesService, SnapshotService],
     exports: [ScenesService, SnapshotService]
   })
   export class ScenesModule {}
   ```

## Testing Requirements

1. **Word count tests** (`/apps/api/src/scenes/utils/word-count.test.ts`):
   ```typescript
   describe('calculateWordCount', () => {
     it('should count words in plain text', () => {
       expect(calculateWordCount('Hello world test')).toBe(3);
     });
     
     it('should ignore markdown syntax', () => {
       expect(calculateWordCount('# Hello **world**')).toBe(2);
     });
     
     it('should handle code blocks', () => {
       const md = 'Text here\n```\ncode block\n```\nMore text';
       expect(calculateWordCount(md)).toBe(3);
     });
   });
   ```

2. **Snapshot service tests** (`/apps/api/src/scenes/snapshot.service.test.ts`):
   - Test snapshot creation
   - Test shouldCreateSnapshot logic
   - Test snapshot retrieval
   - Test restore functionality

3. **Scene service tests** (`/apps/api/tests/scenes.service.test.ts`):
   - Test Markdown content creation
   - Test word count calculation
   - Test version incrementing
   - Test snapshot trigger

4. **E2E tests** (`/apps/api/test/scenes.e2e.test.ts`):
   - Test full create/update flow
   - Test snapshot endpoints
   - Test restore functionality

## Files to Modify/Create
- `/apps/api/src/scenes/dto/update-scene-content.dto.ts` - Create
- `/apps/api/src/scenes/dto/create-scene.dto.ts` - Update
- `/apps/api/src/scenes/utils/word-count.ts` - Create
- `/apps/api/src/scenes/snapshot.service.ts` - Create
- `/apps/api/src/scenes/scenes.service.ts` - Update
- `/apps/api/src/scenes/scenes.controller.ts` - Update
- `/apps/api/src/scenes/scenes.module.ts` - Update
- Test files as specified above

## Validation Commands
```bash
# From project root
cd apps/api

# Run tests
pnpm test

# Run specific test
pnpm vitest word-count

# Type check
pnpm typecheck

# Test endpoints
curl -X POST http://localhost:3001/scenes \
  -H "Content-Type: application/json" \
  -d '{"chapterId":"123","projectId":"456","title":"Test","contentMd":"# Hello World"}'
```

## Notes
- Word count should be recalculated on every content update
- Snapshots provide version history for undo/restore
- CRDT field (`docCrdt`) will be populated by Yjs in ticket 01-core/006
- Consider adding snapshot cleanup for old versions in future