# Ticket: 01-core/008 - Export & Refactor Tools

## Priority
**Medium** - Important for workflow but not blocking core features

## Spec Reference
`/docs/spec-pack.md` sections:
- Export Round-trip user story (lines 182-195)
- Global Rename user story (lines 72-79)
- RenamePreviewRequest/Response (lines 657-668)
- MVP requirement: "mass find/replace" (line 54)
- Spec Evolution #021 (Unified Anchor System) - Critical for reliable refactoring
- Spec Evolution #027 (Deterministic Patch Reapply) - For safe refactor rollback

## Dependencies
- 01-core/001 (Scene Markdown Editor)
- 01-core/002 (Codex System)

## Current State
- No export functionality
- No mass find/replace
- No global rename

## Target State
- Export project to Markdown/YAML zip
- Import from export preserves everything
- Global find/replace with preview
- Mass rename for entities

## Acceptance Criteria
- [ ] Export creates downloadable zip
- [ ] Export includes all scenes, entities, metadata
- [ ] Import restores complete project
- [ ] Find/replace shows preview before applying
- [ ] Entity rename updates all references
- [ ] Tests cover export/import round-trip

## 🌊 Streaming Implementation

### Critical Improvements:
1. **Stream Processing**: Never load entire project in memory
2. **Progress Tracking**: Real-time export/import progress
3. **Chunked Operations**: Process in batches
4. **Memory Management**: Automatic garbage collection
5. **Resumable Exports**: Handle interrupted downloads
6. **Parallel Processing**: Use worker threads for CPU-intensive tasks

## ⚠️ Anchor System Consideration

**Important**: Spec Evolution #021 proposes a unified Anchor system that would make
refactoring significantly more reliable by preventing anchor drift under CRDT edits.
Consider implementing the unified anchor system before or alongside refactor tools to:
- Prevent refactoring positions from drifting during collaborative editing
- Ensure patches can be deterministically reapplied (Evolution #027)
- Maintain consistent behavior across comments, suggestions, and refactors

The current EditSpan model uses separate yjsAnchor and textAnchor fields, but the
unified system would consolidate this into a single, robust Anchor model.

## Implementation Steps

1. **Install Dependencies**
   ```json
   {
     "dependencies": {
       "archiver": "^6.0.0",
       "unzipper": "^0.10.0",
       "js-yaml": "^4.1.0",
       "stream": "built-in",
       "worker_threads": "built-in",
       "p-limit": "^5.0.0"
     }
   }
   ```

2. **Streaming Export Service** (`/apps/api/src/export/export.service.ts`):
   ```typescript
   import * as archiver from 'archiver';
   import * as yaml from 'js-yaml';
   import { Transform, PassThrough, pipeline } from 'stream';
   import { promisify } from 'util';
   import pLimit from 'p-limit';
   const pipelineAsync = promisify(pipeline);
   
   @Injectable()
   export class ExportService {
     async *exportProjectStream(projectId: string, onProgress?: (progress: number) => void) {
       // STREAMING: Never load entire project at once
       const project = await prisma.project.findUnique({
         where: { id: projectId },
         select: {
           id: true,
           name: true,
           version: true
         }
       });
       
       if (!project) throw new NotFoundException();
       
       // Count total items for progress
       const totalCount = await this.countExportItems(projectId);
       let processedCount = 0;
       
       // Create streaming archive
       const archive = archiver('zip', {
         zlib: { level: 6 }, // Balance speed vs compression
         highWaterMark: 1024 * 1024 // 1MB chunks
       });
       
       // Start with metadata
       const metadata = {
         name: project.name,
         version: project.version,
         exportDate: new Date().toISOString(),
         totalItems: totalCount
       };
       archive.append(yaml.dump(metadata), { name: 'project.yaml' });
       processedCount++;
       
       // Stream books with pagination
       const bookStream = this.streamBooks(projectId);
       for await (const book of bookStream) {
         // Stream chapters
         const chapterStream = this.streamChapters(book.id);
         for await (const chapter of chapterStream) {
           // Stream scenes in batches
           const sceneStream = this.streamScenes(chapter.id);
           
           for await (const sceneBatch of sceneStream) {
             // Process batch in parallel with concurrency limit
             const limit = pLimit(5); // Max 5 concurrent
             
             const processPromises = sceneBatch.map(scene => 
               limit(async () => {
                 const scenePath = `books/${book.title}/chapters/${chapter.title}/scenes/${scene.title || scene.id}.md`;
                 
                 // Get content separately to avoid memory bloat
                 const content = await this.getSceneContent(scene.id);
                 
                 const frontMatter = {
                   id: scene.id,
                   index: scene.index,
                   status: scene.status,
                   wordCount: scene.wordCount
                 };
                 
                 const fullContent = `---\n${yaml.dump(frontMatter)}---\n\n${content}`;
                 archive.append(fullContent, { name: scenePath });
                 
                 processedCount++;
                 if (onProgress) {
                   onProgress((processedCount / totalCount) * 100);
                 }
               })
             );
             
             await Promise.all(processPromises);
             
             // Yield control to prevent blocking
             yield { type: 'progress', processed: processedCount, total: totalCount };
           }
         }
       }
       
       // Stream entities in chunks
       const entityStream = this.streamEntities(projectId);
       const entityChunks = [];
       
       for await (const entityBatch of entityStream) {
         entityChunks.push(...entityBatch);
         
         // Write entities in chunks of 100
         if (entityChunks.length >= 100) {
           archive.append(
             yaml.dump(entityChunks.splice(0, 100)),
             { name: `codex/entities-${Date.now()}.yaml` }
           );
         }
       }
       
       // Write remaining entities
       if (entityChunks.length > 0) {
         archive.append(
           yaml.dump(entityChunks),
           { name: 'codex/entities-final.yaml' }
         );
       }
       
       await archive.finalize();
       
       // Stream archive data
       let chunk;
       while ((chunk = archive.read()) !== null) {
         yield { type: 'data', chunk };
       }
       
       yield { type: 'complete', processed: processedCount };
     }
     
     // Helper streaming methods
     private async *streamBooks(projectId: string, batchSize = 10) {
       let offset = 0;
       let hasMore = true;
       
       while (hasMore) {
         const books = await prisma.book.findMany({
           where: { projectId },
           skip: offset,
           take: batchSize,
           select: { id: true, title: true }
         });
         
         if (books.length === 0) {
           hasMore = false;
         } else {
           for (const book of books) {
             yield book;
           }
           offset += batchSize;
         }
       }
     }
     
     private async *streamChapters(bookId: string, batchSize = 20) {
       let offset = 0;
       let hasMore = true;
       
       while (hasMore) {
         const chapters = await prisma.chapter.findMany({
           where: { bookId },
           skip: offset,
           take: batchSize,
           orderBy: { index: 'asc' },
           select: { id: true, title: true }
         });
         
         if (chapters.length === 0) {
           hasMore = false;
         } else {
           for (const chapter of chapters) {
             yield chapter;
           }
           offset += batchSize;
         }
       }
     }
     
     private async *streamScenes(chapterId: string, batchSize = 50) {
       let offset = 0;
       let hasMore = true;
       
       while (hasMore) {
         const scenes = await prisma.scene.findMany({
           where: { chapterId },
           skip: offset,
           take: batchSize,
           orderBy: { index: 'asc' },
           select: {
             id: true,
             title: true,
             index: true,
             status: true,
             wordCount: true
           }
         });
         
         if (scenes.length === 0) {
           hasMore = false;
         } else {
           yield scenes; // Yield entire batch
           offset += batchSize;
         }
       }
     }
     
     private async getSceneContent(sceneId: string): Promise<string> {
       const scene = await prisma.scene.findUnique({
         where: { id: sceneId },
         select: { contentMd: true }
       });
       return scene?.contentMd || '';
     }
     
     async importProject(zipBuffer: Buffer, userId: string): Promise<Project> {
       // Parse zip and recreate project structure
       // Implementation would use 'unzipper' package
       // This is simplified for brevity
       
       const project = await prisma.project.create({
         data: {
           name: 'Imported Project',
           users: {
             create: {
               userId,
               role: 'OWNER'
             }
           }
         }
       });
       
       // Import books, chapters, scenes, entities...
       // (Full implementation would parse the zip)
       
       return project;
     }
   }
   ```

3. **Streaming Refactor Service** (`/apps/api/src/refactor/refactor.service.ts`):
   ```typescript
   @Injectable()
   export class RefactorService {
     async *previewRenameStream(dto: RenamePreviewDto) {
       // STREAMING: Process scenes in batches
       const totalScenes = await prisma.scene.count({
         where: { projectId: dto.projectId }
       });
       
       let processedScenes = 0;
       const changes: RenameChange[] = [];
       const batchSize = 100;
       let offset = 0;
       
       while (processedScenes < totalScenes) {
         // Get batch of scenes
         const scenes = await prisma.scene.findMany({
           where: { projectId: dto.projectId },
           skip: offset,
           take: batchSize,
           select: { id: true, title: true }
         });
         
         if (scenes.length === 0) break;
         
         // Process batch in parallel using worker threads
         const Worker = require('worker_threads').Worker;
         const workerPromises = scenes.map(scene => 
           new Promise((resolve, reject) => {
             const worker = new Worker(`
               const { parentPort, workerData } = require('worker_threads');
               
               async function processScene() {
                 const { sceneId, searchPattern, replacement } = workerData;
                 
                 // Get content
                 const scene = await prisma.scene.findUnique({
                   where: { id: sceneId },
                   select: { contentMd: true }
                 });
                 
                 const content = scene?.contentMd || '';
                 const regex = new RegExp(searchPattern, 'gi');
                 const matches = content.match(regex);
                 
                 if (matches && matches.length > 0) {
                   parentPort.postMessage({
                     sceneId,
                     occurrences: matches.length,
                     preview: content.substring(0, 200)
                   });
                 } else {
                   parentPort.postMessage(null);
                 }
               }
               
               processScene();
             `, { eval: true, workerData: {
               sceneId: scene.id,
               searchPattern: this.escapeRegex(dto.from),
               replacement: dto.to
             }});
             
             worker.on('message', resolve);
             worker.on('error', reject);
           })
         );
         
         const results = await Promise.all(workerPromises);
         
         // Collect changes
         for (const result of results) {
           if (result) {
             changes.push(result);
           }
         }
         
         processedScenes += scenes.length;
         offset += batchSize;
         
         // Yield progress
         yield {
           type: 'progress',
           processed: processedScenes,
           total: totalScenes,
           changes: changes.length
         };
       }
       
       // Also check entity names and aliases
       if (dto.includeAliases) {
         const entities = await prisma.entity.findMany({
           where: {
             projectId: dto.projectId,
             OR: [
               { name: dto.from },
               { aliases: { has: dto.from } }
             ]
           }
         });
         
         for (const entity of entities) {
           changes.push({
             entityId: entity.id,
             entityName: entity.name,
             type: 'entity',
             before: entity.name,
             after: dto.to
           });
         }
       }
       
       return { changes, totalOccurrences: changes.length };
     }
     
     async applyRename(dto: ApplyRenameDto): Promise<void> {
       const preview = await this.previewRename(dto);
       
       await prisma.$transaction(async (tx) => {
         // Update scenes
         for (const change of preview.changes) {
           if (change.sceneId) {
             const scene = await tx.scene.findUnique({
               where: { id: change.sceneId }
             });
             
             const regex = new RegExp(this.escapeRegex(dto.from), 'gi');
             const newContent = scene.contentMd.replace(regex, dto.to);
             
             await tx.scene.update({
               where: { id: change.sceneId },
               data: {
                 contentMd: newContent,
                 version: { increment: 1 }
               }
             });
           }
           
           // Update entities
           if (change.entityId) {
             await tx.entity.update({
               where: { id: change.entityId },
               data: {
                 name: dto.to,
                 aliases: {
                   set: (await tx.entity.findUnique({
                     where: { id: change.entityId }
                   })).aliases.map(a => a === dto.from ? dto.to : a)
                 }
               }
             });
           }
         }
       });
     }
     
     async findInProject(projectId: string, searchTerm: string) {
       const scenes = await prisma.scene.findMany({
         where: {
           projectId,
           contentMd: { contains: searchTerm, mode: 'insensitive' }
         },
         select: { id: true, title: true, contentMd: true }
       });
       
       return scenes.map(scene => ({
         sceneId: scene.id,
         title: scene.title,
         matches: this.findMatches(scene.contentMd, searchTerm)
       }));
     }
     
     private escapeRegex(str: string): string {
       return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     }
     
     private getPreviewSnippet(content: string, term: string, context = 50): string {
       const index = content.toLowerCase().indexOf(term.toLowerCase());
       if (index === -1) return '';
       
       const start = Math.max(0, index - context);
       const end = Math.min(content.length, index + term.length + context);
       
       return '...' + content.substring(start, end) + '...';
     }
     
     private findMatches(content: string, term: string) {
       const regex = new RegExp(this.escapeRegex(term), 'gi');
       const matches = [];
       let match;
       
       while ((match = regex.exec(content)) !== null) {
         matches.push({
           index: match.index,
           text: match[0],
           context: this.getPreviewSnippet(content, term)
         });
       }
       
       return matches;
     }
   }
   ```

4. **Streaming Controller** (`/apps/api/src/tools/tools.controller.ts`):
   ```typescript
   import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
   import { Controller, Get, Post, Param, Res, Sse, MessageEvent } from '@nestjs/common';
   import { Response } from 'express';
   import { Observable } from 'rxjs';
   
   @Controller('tools')
   export class ToolsController {
     constructor(
       private exportService: ExportService,
       private refactorService: RefactorService
     ) {}
     
     /**
      * Stream export with progress tracking
      */
     @Get('export/:projectId')
     @Roles('READER')
     async exportProject(
       @Param('projectId') projectId: string,
       @Res() res: Response
     ) {
       // Set headers for streaming
       res.set({
         'Content-Type': 'application/zip',
         'Content-Disposition': `attachment; filename="project-export-${Date.now()}.zip"`,
         'Transfer-Encoding': 'chunked',
         'Cache-Control': 'no-cache',
         'X-Content-Type-Options': 'nosniff'
       });
       
       try {
         // Stream export data
         const exportStream = this.exportService.exportProjectStream(projectId);
         
         for await (const chunk of exportStream) {
           if (chunk.type === 'data') {
             // Write chunk to response
             if (!res.write(chunk.chunk)) {
               // Backpressure - wait for drain
               await new Promise(resolve => res.once('drain', resolve));
             }
           } else if (chunk.type === 'progress') {
             // Could send progress via SSE on different endpoint
             console.log(`Export progress: ${chunk.processed}/${chunk.total}`);
           }
         }
         
         res.end();
       } catch (error) {
         console.error('Export failed:', error);
         if (!res.headersSent) {
           res.status(500).json({ error: 'Export failed' });
         }
       }
     }
     
     /**
      * Server-Sent Events for export progress
      */
     @Sse('export/:projectId/progress')
     exportProgress(@Param('projectId') projectId: string): Observable<MessageEvent> {
       return new Observable(subscriber => {
         this.trackExportProgress(projectId, subscriber);
       });
     }
     
     private async trackExportProgress(projectId: string, subscriber: any) {
       const exportStream = this.exportService.exportProjectStream(
         projectId,
         (progress) => {
           subscriber.next({
             data: {
               type: 'progress',
               percentage: progress
             }
           });
         }
       );
       
       for await (const chunk of exportStream) {
         if (chunk.type === 'complete') {
           subscriber.next({
             data: {
               type: 'complete',
               processed: chunk.processed
             }
           });
           subscriber.complete();
         } else if (chunk.type === 'error') {
           subscriber.next({
             data: {
               type: 'error',
               message: chunk.message
             }
           });
           subscriber.complete();
         }
       }
     }
     
     @Post('import')
     @UseInterceptors(FileInterceptor('file'))
     async importProject(
       @UploadedFile() file: Express.Multer.File,
       @CurrentUser() user: any
     ) {
       return this.exportService.importProject(file.buffer, user.sub);
     }
     
     /**
      * Stream rename preview for large projects
      */
     @Sse('rename/preview')
     @Roles('WRITER')
     previewRenameStream(@TypedBody() dto: RenamePreviewDto): Observable<MessageEvent> {
       return new Observable(subscriber => {
         this.streamRenamePreview(dto, subscriber);
       });
     }
     
     private async streamRenamePreview(dto: RenamePreviewDto, subscriber: any) {
       const previewStream = this.refactorService.previewRenameStream(dto);
       
       for await (const update of previewStream) {
         subscriber.next({
           data: update
         });
         
         if (update.type === 'complete') {
           subscriber.complete();
         }
       }
     }
     
     @TypedRoute.Post('rename/apply')
     @Roles('WRITER')
     async applyRename(@TypedBody() dto: ApplyRenameDto) {
       await this.refactorService.applyRename(dto);
       return { success: true };
     }
     
     @Get('find')
     @Roles('READER')
     async findInProject(
       @Query('projectId') projectId: string,
       @Query('q') searchTerm: string
     ) {
       return this.refactorService.findInProject(projectId, searchTerm);
     }
   }
   ```

## Testing Requirements
- Test export creates valid zip
- Test import restores all data
- Test find/replace accuracy
- Test entity rename updates all references
- Test preview matches actual changes

## Files to Modify/Create
- `/apps/api/src/export/` - Export module
- `/apps/api/src/refactor/` - Refactor module
- `/apps/api/src/tools/` - Combined controller
- Test files

## Validation Commands
```bash
cd apps/api
pnpm test tools

# Test export
curl http://localhost:3001/tools/export/PROJECT_ID \
  -H "Authorization: Bearer TOKEN" \
  --output export.zip

# Test rename preview
curl -X POST http://localhost:3001/tools/rename/preview \
  -H "Content-Type: application/json" \
  -d '{"projectId":"123","from":"Bob","to":"Robert"}'
```

## Notes
- Consider compression for large exports
- Implement progress tracking for large operations
- Add undo functionality for renames
- Support regex in find/replace (advanced feature)