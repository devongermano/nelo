# Ticket: 01-core/005 - AI Generation Suite

## Priority
**Critical** - Core feature for AI-assisted writing

## Spec Reference
`/docs/spec-pack.md` sections:
- GenerateRequest schema (lines 648-656)
- Run model (lines 523-537)
- CostEvent tracking (lines 449-459)
- WRITE/REWRITE/DESCRIBE actions

## Dependencies
- 01-core/003 (AI Provider Adapters)
- 01-core/004 (Context Composition Engine)

## Current State
- No generation endpoints
- No streaming support
- No cost tracking
- No run history

## Target State
- `/generate` endpoint with WRITE, REWRITE, DESCRIBE actions
- Streaming support for real-time output
- Cost tracking per generation
- Run history with token counts

## Acceptance Criteria
- [ ] WRITE action generates new content
- [ ] REWRITE action improves existing content
- [ ] DESCRIBE action creates descriptions
- [ ] Streaming works via WebSocket
- [ ] Costs tracked in database
- [ ] Run history saved
- [ ] Budget limits enforced

## 🚀 Enhanced Implementation with Queue System

### Critical Improvements:
1. **Bull Queue**: Robust job queue with Redis backend
2. **Backpressure Handling**: Prevent overwhelming the system
3. **SSE with Proper Error Handling**: Server-Sent Events for streaming
4. **Atomic Budget Checks**: Prevent race conditions
5. **Dead Letter Queue**: Handle failed jobs gracefully
6. **Request Deduplication**: Cache identical prompts

## Implementation Steps

1. **Install Dependencies**
   ```json
   {
     "dependencies": {
       "bull": "^4.11.0",
       "@nestjs/bull": "^10.0.0",
       "ioredis": "^5.3.0",
       "crypto": "built-in"
     }
   }
   ```

2. **Setup Bull Queue Module** (`/apps/api/src/generation/generation.module.ts`):
   ```typescript
   import { Module } from '@nestjs/common';
   import { BullModule } from '@nestjs/bull';
   import { GenerationProcessor } from './generation.processor';
   import { GenerationService } from './generation.service';
   import { GenerationController } from './generation.controller';
   
   @Module({
     imports: [
       BullModule.registerQueue({
         name: 'generation',
         defaultJobOptions: {
           attempts: 3,
           backoff: {
             type: 'exponential',
             delay: 2000,
           },
           removeOnComplete: false, // Keep for analytics
           removeOnFail: false, // Keep for debugging
         },
       }),
       BullModule.registerQueue({
         name: 'generation-dlq', // Dead letter queue
       }),
     ],
     providers: [GenerationProcessor, GenerationService],
     controllers: [GenerationController],
     exports: [GenerationService],
   })
   export class GenerationModule {}
   ```

3. **Create Queue Processor** (`/apps/api/src/generation/generation.processor.ts`):
   ```typescript
   import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
   import { Job } from 'bull';
   import { AIProviderFactory } from '@nelo/ai-adapters';
   import { ContextComposer } from '@nelo/context-engine';
   import { Logger } from '@nestjs/common';
   
   @Processor('generation')
   export class GenerationProcessor {
     private readonly logger = new Logger(GenerationProcessor.name);
     private contextComposer: ContextComposer;
     private activeJobs = new Map<string, AbortController>();
     
     constructor() {
       this.contextComposer = new ContextComposer();
       AIProviderFactory.initialize();
     }
     
     @Process('generate')
     async handleGeneration(job: Job) {
       const { dto, userId, runId } = job.data;
       const abortController = new AbortController();
       this.activeJobs.set(job.id, abortController);
       
       try {
         // Update run status
         await this.updateRunStatus(runId, 'RUNNING');
         
         // Compose context
         const context = await this.contextComposer.composeContext({
           sceneId: dto.sceneId,
           ...dto.contextOptions,
         });
         
         // Check for abort signal
         if (abortController.signal.aborted) {
           throw new Error('Job aborted');
         }
         
         // Get provider
         const provider = await this.getProvider(dto.modelProfileId, userId);
         
         // Build prompt
         const prompt = this.buildPrompt(dto.action, context, dto.promptOverride);
         
         // Generate with backpressure handling
         const result = await this.generateWithBackpressure(
           provider,
           prompt,
           dto,
           runId,
           abortController.signal
         );
         
         // Track costs
         await this.trackCosts(runId, result);
         
         return result;
       } catch (error) {
         this.logger.error(`Generation failed: ${error.message}`, error.stack);
         await this.updateRunStatus(runId, 'FAILED');
         throw error;
       } finally {
         this.activeJobs.delete(job.id);
       }
     }
     
     private async generateWithBackpressure(
       provider: any,
       prompt: any,
       dto: any,
       runId: string,
       signal: AbortSignal
     ) {
       // Monitor memory usage
       const memUsage = process.memoryUsage();
       const memThreshold = 0.8; // 80% memory threshold
       
       if (memUsage.heapUsed / memUsage.heapTotal > memThreshold) {
         // Apply backpressure
         await new Promise(resolve => setTimeout(resolve, 1000));
         
         // Force garbage collection if available
         if (global.gc) {
           global.gc();
         }
       }
       
       // Check concurrent job limit
       if (this.activeJobs.size > 10) {
         throw new Error('Too many concurrent generation jobs');
       }
       
       // Generate with abort signal
       const result = await provider.generate(prompt, {
         signal,
         ...dto.options,
       });
       
       return result;
     }
     
     @OnQueueActive()
     onActive(job: Job) {
       this.logger.log(`Processing job ${job.id} of type ${job.name}`);
     }
     
     @OnQueueCompleted()
     onComplete(job: Job, result: any) {
       this.logger.log(`Job ${job.id} completed successfully`);
     }
     
     @OnQueueFailed()
     async onFail(job: Job, err: Error) {
       this.logger.error(`Job ${job.id} failed: ${err.message}`);
       
       // Move to dead letter queue after max attempts
       if (job.attemptsMade >= job.opts.attempts!) {
         await this.moveToDeadLetterQueue(job);
       }
     }
     
     private async moveToDeadLetterQueue(job: Job) {
       const dlqQueue = this.getQueue('generation-dlq');
       await dlqQueue.add('failed-generation', job.data, {
         delay: 0,
         attempts: 1,
       });
     }
   }
   ```

4. **Enhanced Generation Service** (`/apps/api/src/generation/generation.service.ts`):
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { InjectQueue } from '@nestjs/bull';
   import { Queue } from 'bull';
   import { AIProviderFactory } from '@nelo/ai-adapters';
   import { ContextComposer } from '@nelo/context-engine';
   import { calculateCost } from '@nelo/ai-adapters';
   
   @Injectable()
   export class GenerationService {
     constructor(
       private contextComposer: ContextComposer,
       private providerKeyService: ProviderKeyService
     ) {}
     
     constructor(
       @InjectQueue('generation') private generationQueue: Queue,
       private contextComposer: ContextComposer,
       private providerKeyService: ProviderKeyService
     ) {}
     
     async generate(dto: GenerateRequestDto, userId: string) {
       // ATOMIC: Check budget with transaction
       const canProceed = await this.atomicBudgetCheck(dto.projectId);
       if (!canProceed) {
         throw new ForbiddenException('Budget limit reached');
       }
       
       // Check for duplicate requests (deduplication)
       const cacheKey = this.getRequestHash(dto);
       const cached = await this.redis.get(`gen:${cacheKey}`);
       
       if (cached && !dto.skipCache) {
         // Return cached result for identical prompt
         return JSON.parse(cached);
       }
       
       // Create run record
       const run = await prisma.run.create({
         data: {
           sceneId: dto.sceneId,
           projectId: dto.projectId,
           action: dto.action,
           status: 'PENDING'
         }
       });
       
       // Add to queue with priority
       const job = await this.generationQueue.add(
         'generate',
         {
           dto,
           userId,
           runId: run.id
         },
         {
           priority: this.getPriority(dto),
           delay: dto.scheduledFor ? new Date(dto.scheduledFor).getTime() - Date.now() : 0,
           attempts: 3,
           backoff: {
             type: 'exponential',
             delay: 2000
           }
         }
       );
       
       // Return job info for tracking
       return {
         runId: run.id,
         jobId: job.id,
         status: 'queued',
         position: await job.getPosition(),
         estimatedTime: await this.estimateCompletionTime(job)
       };
     }
     
     private async atomicBudgetCheck(projectId: string): Promise<boolean> {
       return await prisma.$transaction(async (tx) => {
         const budget = await tx.budget.findFirst({
           where: { projectId },
           select: { limitUSD: true, spentUSD: true }
         });
         
         if (!budget) return true;
         
         // Reserve budget amount (estimated)
         const estimatedCost = 0.10; // Estimated max cost per generation
         
         if (budget.spentUSD + estimatedCost > budget.limitUSD) {
           return false;
         }
         
         // Update with reservation
         await tx.budget.update({
           where: { projectId },
           data: {
             spentUSD: { increment: estimatedCost },
             reservedUSD: { increment: estimatedCost }
           }
         });
         
         return true;
       }, {
         isolationLevel: 'Serializable' // Prevent race conditions
       });
     }
     
     private getRequestHash(dto: GenerateRequestDto): string {
       const crypto = require('crypto');
       const hash = crypto.createHash('sha256');
       
       // Create deterministic hash of request
       const normalized = {
         sceneId: dto.sceneId,
         action: dto.action,
         modelProfileId: dto.modelProfileId,
         promptOverride: dto.promptOverride,
         contextOptions: dto.contextOptions
       };
       
       hash.update(JSON.stringify(normalized));
       return hash.digest('hex');
     }
     
     private getPriority(dto: GenerateRequestDto): number {
       // Higher priority for interactive requests
       switch (dto.action) {
         case 'REWRITE': return 1; // Highest - user waiting
         case 'WRITE': return 2;
         case 'DESCRIBE': return 3;
         default: return 5;
       }
     }
     
     private buildPrompt(action: string, context: any, override?: any) {
       if (override) return override;
       
       const prompts = {
         WRITE: {
           system: 'You are a creative writing assistant.',
           user: `Continue writing the scene based on the context provided.
                  ${JSON.stringify(context.promptObject)}`
         },
         REWRITE: {
           system: 'You are an editor improving prose.',
           user: `Rewrite the following content to improve flow and style:
                  ${context.promptObject.sceneContext[0].content}`
         },
         DESCRIBE: {
           system: 'You are a descriptive writer.',
           user: `Create a vivid description based on:
                  ${JSON.stringify(context.promptObject)}`
         }
       };
       
       return prompts[action];
     }
     
     private async streamGeneration(adapter: any, prompt: any, runId: string) {
       const stream = adapter.generateStream(prompt.user, {
         systemPrompt: prompt.system
       });
       
       let fullText = '';
       let tokenCount = 0;
       
       // Return async generator for streaming
       return {
         async *[Symbol.asyncIterator]() {
           for await (const chunk of stream) {
             fullText += chunk;
             tokenCount++;
             yield { chunk, index: tokenCount };
           }
           
           // Update run when complete
           await prisma.run.update({
             where: { id: runId },
             data: {
               status: 'COMPLETE',
               outputTokens: tokenCount,
               inputTokens: Math.ceil(JSON.stringify(prompt).length / 4)
             }
           });
           
           // Track cost
           await this.trackCost(runId, tokenCount);
         }
       };
     }
     
     private async generateSync(adapter: any, prompt: any, runId: string) {
       const result = await adapter.generate(prompt.user, {
         systemPrompt: prompt.system
       });
       
       const inputTokens = Math.ceil(JSON.stringify(prompt).length / 4);
       const outputTokens = Math.ceil(result.length / 4);
       
       await prisma.run.update({
         where: { id: runId },
         data: {
           status: 'COMPLETE',
           inputTokens,
           outputTokens
         }
       });
       
       await this.trackCost(runId, outputTokens, inputTokens);
       
       return result;
     }
     
     private async trackCost(runId: string, outputTokens: number, inputTokens = 0) {
       const run = await prisma.run.findUnique({
         where: { id: runId }
       });
       
       const cost = calculateCost(run.model, inputTokens, outputTokens);
       
       await prisma.costEvent.create({
         data: {
           runId,
           amount: cost
         }
       });
       
       // Update project spend
       await prisma.budget.updateMany({
         where: { projectId: run.projectId },
         data: { spentUSD: { increment: cost } }
       });
     }
     
     private async checkBudget(projectId: string) {
       const budget = await prisma.budget.findFirst({
         where: { projectId }
       });
       
       if (budget && budget.spentUSD >= budget.limitUSD) {
         throw new ForbiddenException('Budget limit reached');
       }
     }
   }
   ```

2. **Create generation controller** (`/apps/api/src/generation/generation.controller.ts`):
   ```typescript
   import { TypedBody, TypedRoute } from '@nestia/core';
   
   @Controller('generate')
   export class GenerationController {
     constructor(private generationService: GenerationService) {}
     
     @TypedRoute.Post()
     async generate(
       @TypedBody() dto: GenerateRequestDto,
       @CurrentUser() user: any
     ) {
       return this.generationService.generate(dto, user.id);
     }
     
     @Get('runs/:projectId')
     async getRuns(@Param('projectId') projectId: string) {
       return prisma.run.findMany({
         where: { projectId },
         orderBy: { createdAt: 'desc' },
         include: { costEvents: true }
       });
     }
     
     @Get('costs/:projectId')
     async getCosts(@Param('projectId') projectId: string) {
       const costs = await prisma.costEvent.findMany({
         where: { run: { projectId } },
         orderBy: { createdAt: 'desc' }
       });
       
       const total = costs.reduce((sum, c) => sum + c.amount, 0);
       
       return { costs, total };
     }
   }
   ```

5. **SSE Streaming Controller** (`/apps/api/src/generation/generation-stream.controller.ts`):
   ```typescript
   import { Controller, Get, Param, Sse, MessageEvent } from '@nestjs/common';
   import { Observable, interval, map, filter } from 'rxjs';
   import { InjectQueue } from '@nestjs/bull';
   import { Queue } from 'bull';
   
   @Controller('generation/stream')
   export class GenerationStreamController {
     constructor(
       @InjectQueue('generation') private generationQueue: Queue,
       private generationService: GenerationService
     ) {}
     
     /**
      * Server-Sent Events endpoint for streaming generation
      */
     @Sse(':jobId')
     streamGeneration(@Param('jobId') jobId: string): Observable<MessageEvent> {
       return new Observable(subscriber => {
         this.streamJob(jobId, subscriber);
       });
     }
     
     private async streamJob(jobId: string, subscriber: any) {
       const job = await this.generationQueue.getJob(jobId);
       
       if (!job) {
         subscriber.next({ data: { error: 'Job not found' } });
         subscriber.complete();
         return;
       }
       
       // Set up backpressure monitoring
       let bufferSize = 0;
       const maxBufferSize = 1000; // Max 1000 pending messages
       
       // Stream progress updates
       const progressInterval = setInterval(async () => {
         const progress = await job.progress();
         
         // Apply backpressure if buffer is full
         if (bufferSize > maxBufferSize) {
           // Pause streaming
           await new Promise(resolve => setTimeout(resolve, 100));
         }
         
         bufferSize++;
         subscriber.next({
           data: {
             type: 'progress',
             progress,
             state: await job.getState()
           }
         });
         bufferSize--;
       }, 100);
       
       // Wait for completion
       job.finished().then(result => {
         clearInterval(progressInterval);
         
         // Stream final result
         if (result.stream) {
           this.streamResult(result, subscriber);
         } else {
           subscriber.next({
             data: {
               type: 'complete',
               result
             }
           });
           subscriber.complete();
         }
       }).catch(error => {
         clearInterval(progressInterval);
         subscriber.next({
           data: {
             type: 'error',
             error: error.message
           }
         });
         subscriber.complete();
       });
     }
     
     private async streamResult(result: any, subscriber: any) {
       // Stream tokens with backpressure handling
       const stream = result.stream;
       let tokenCount = 0;
       
       for await (const chunk of stream) {
         // Check if client is still connected
         if (subscriber.closed) {
           break;
         }
         
         tokenCount++;
         
         // Apply backpressure every 100 tokens
         if (tokenCount % 100 === 0) {
           await new Promise(resolve => setTimeout(resolve, 10));
         }
         
         subscriber.next({
           data: {
             type: 'token',
             chunk,
             index: tokenCount
           }
         });
       }
       
       subscriber.next({
         data: {
           type: 'complete',
           tokenCount
         }
       });
       subscriber.complete();
     }
   }
   ```

6. **Add WebSocket Support** (`/apps/api/src/gateway/generation.gateway.ts`):
   ```typescript
   import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
   import { Socket } from 'socket.io';
   import { UseGuards } from '@nestjs/common';
   import { WsAuthGuard } from '../auth/ws-auth.guard';
   
   @WebSocketGateway({
     namespace: 'generation',
     cors: true
   })
   @UseGuards(WsAuthGuard)
   export class GenerationGateway {
     private activeStreams = new Map<string, AbortController>();
     
     @SubscribeMessage('generate.start')
     async handleGeneration(
       @ConnectedSocket() client: Socket,
       @MessageBody() payload: any
     ) {
       const abortController = new AbortController();
       this.activeStreams.set(client.id, abortController);
       
       try {
         const result = await this.generationService.generateStream(
           payload,
           client.data.userId,
           abortController.signal
         );
         
         // Handle backpressure
         let pendingAcks = 0;
         const maxPendingAcks = 10;
         
         for await (const { chunk, index } of result) {
           if (abortController.signal.aborted) {
             break;
           }
           
           // Wait if too many unacknowledged messages
           while (pendingAcks >= maxPendingAcks) {
             await new Promise(resolve => setTimeout(resolve, 50));
           }
           
           pendingAcks++;
           
           client.emit('run.delta', {
             runId: payload.runId,
             chunk,
             index
           }, (ack: boolean) => {
             pendingAcks--;
           });
         }
         
         client.emit('run.done', { runId: payload.runId });
       } catch (error) {
         client.emit('run.error', {
           runId: payload.runId,
           error: error.message
         });
       } finally {
         this.activeStreams.delete(client.id);
       }
     }
     
     @SubscribeMessage('generate.abort')
     handleAbort(@ConnectedSocket() client: Socket) {
       const controller = this.activeStreams.get(client.id);
       if (controller) {
         controller.abort();
         this.activeStreams.delete(client.id);
       }
     }
     
     handleDisconnect(client: Socket) {
       // Clean up on disconnect
       const controller = this.activeStreams.get(client.id);
       if (controller) {
         controller.abort();
         this.activeStreams.delete(client.id);
       }
     }
   }
   ```

## Testing Requirements
- Test all three actions (WRITE, REWRITE, DESCRIBE)
- Test streaming vs sync generation
- Test cost calculation
- Test budget enforcement
- Mock AI providers to avoid costs

## Files to Modify/Create
- `/apps/api/src/generation/` - New module
- `/apps/api/src/generation/generation.service.ts`
- `/apps/api/src/generation/generation.controller.ts`
- `/apps/api/src/gateway/generation.gateway.ts`
- Test files

## Validation Commands
```bash
cd apps/api
pnpm test generation

# Test generation
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{"sceneId":"123","action":"WRITE","modelProfileId":"456"}'
```

## Notes
- Streaming essential for good UX
- Cost tracking must be accurate
- Consider rate limiting per user
- Cache contexts to reduce API calls