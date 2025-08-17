# Ticket: 01-core/009 - Tokenizer Service

## Priority
**Medium** - Important for accurate cost estimation but not blocking core features

## Spec Reference
- Spec Evolution #009 (ModelProfile Tokenization Fields)
- Spec Evolution #013 (Tokenizer Registry Pattern)

## Dependencies
- 01-core/003 (AI Provider Adapters) - In progress
- 00-structural/001 (Database Schema) - Complete ✅

## Current State
- No tokenization infrastructure
- No way to estimate tokens before generation
- Cost tracking is reactive (after generation)
- No token counting for context window management

## Target State
- Tokenizer registry mapping models to tokenizers
- `/tokenize/estimate` endpoint for pre-generation estimates
- Accurate token counting for different models
- Integration with ModelProfile for limits
- Support for multiple tokenizer implementations

## Acceptance Criteria
- [ ] Tokenizer registry with pluggable implementations
- [ ] `/tokenize/estimate` endpoint returns token counts
- [ ] Support for GPT (tiktoken) and Claude tokenizers
- [ ] Fallback heuristic for unknown models
- [ ] Integration with context composer for window limits
- [ ] Caching for repeated estimations
- [ ] Tests verify accuracy within 5% of actual

## Implementation Steps

### 1. Expand ModelProfile Schema

Update `/packages/db/prisma/schema.prisma`:
```prisma
model ModelProfile {
  id              String   @id @default(uuid())
  name            String
  provider        String
  config          Json
  
  // New tokenization fields
  maxInputTokens  Int?     // Model's context window size
  maxOutputTokens Int?     // Maximum generation length
  pricing         Json?    // { inputPer1K: 0.01, outputPer1K: 0.03, currency: "USD" }
  tokenizer       String?  // "tiktoken:cl100k_base" | "anthropic:claude-3" | etc
  throughputQPS   Int?     // Rate limit in queries per second
  supportsNSFW    Boolean? @default(false)
  
  project         Project? @relation(fields: [projectId], references: [id])
  projectId       String?
}
```

### 2. Create Tokenizer Module

Create `/apps/api/src/tokenizer/tokenizer.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TokenizerController } from './tokenizer.controller';
import { TokenizerService } from './tokenizer.service';
import { TokenizerRegistry } from './tokenizer.registry';

@Module({
  controllers: [TokenizerController],
  providers: [TokenizerService, TokenizerRegistry],
  exports: [TokenizerService],
})
export class TokenizerModule {}
```

### 3. Create Tokenizer Registry

Create `/apps/api/src/tokenizer/tokenizer.registry.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { encoding_for_model, get_encoding, Tiktoken } from 'tiktoken';

export interface Tokenizer {
  name: string;
  encode(text: string): number[];
  decode(tokens: number[]): string;
  countTokens(text: string): number;
}

@Injectable()
export class TokenizerRegistry {
  private tokenizers = new Map<string, Tokenizer>();
  private encodings = new Map<string, Tiktoken>();
  
  constructor() {
    this.registerDefaults();
  }
  
  private registerDefaults() {
    // Initialize encodings (these are cached internally by tiktoken)
    const cl100k = get_encoding('cl100k_base');
    const p50k = get_encoding('p50k_base');
    
    this.encodings.set('cl100k_base', cl100k);
    this.encodings.set('p50k_base', p50k);
    
    // GPT-4 tokenizer (cl100k_base)
    this.register('tiktoken:cl100k_base', {
      name: 'cl100k_base',
      encode: (text) => Array.from(cl100k.encode(text)),
      decode: (tokens) => cl100k.decode(new Uint32Array(tokens)),
      countTokens: (text) => cl100k.encode(text).length,
    });
    
    // GPT-3.5 tokenizer
    this.register('tiktoken:p50k_base', {
      name: 'p50k_base',
      encode: (text) => Array.from(p50k.encode(text)),
      decode: (tokens) => p50k.decode(new Uint32Array(tokens)),
      countTokens: (text) => p50k.encode(text).length,
    });
    
    // Claude tokenizer (approximate - actual SDK not available)
    this.register('anthropic:claude-3', {
      name: 'claude-3',
      encode: (text) => this.heuristicTokenize(text, 3.5),
      decode: (tokens) => '',
      countTokens: (text) => Math.ceil(text.length / 3.5),
    });
    
    // Fallback heuristic tokenizer
    this.register('heuristic:default', {
      name: 'default',
      encode: (text) => this.heuristicTokenize(text, 4),
      decode: (tokens) => '',
      countTokens: (text) => Math.ceil(text.length / 4),
    });
  }
  
  private heuristicTokenize(text: string, charsPerToken: number): number[] {
    const tokenCount = Math.ceil(text.length / charsPerToken);
    return Array(tokenCount).fill(0).map((_, i) => i);
  }
  
  register(key: string, tokenizer: Tokenizer) {
    this.tokenizers.set(key, tokenizer);
  }
  
  get(key: string): Tokenizer {
    // Try exact match first
    if (this.tokenizers.has(key)) {
      return this.tokenizers.get(key)!;
    }
    
    // Try pattern matching (e.g., "gpt-4" matches "tiktoken:cl100k_base")
    if (key.includes('gpt-4') || key.includes('gpt-3.5-turbo')) {
      return this.tokenizers.get('tiktoken:cl100k_base')!;
    }
    if (key.includes('claude')) {
      return this.tokenizers.get('anthropic:claude-3')!;
    }
    
    // Fallback to heuristic
    return this.tokenizers.get('heuristic:default')!;
  }
}
```

### 4. Create Tokenizer Service

Create `/apps/api/src/tokenizer/tokenizer.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@nelo/db';
import { TokenizerRegistry } from './tokenizer.registry';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

export interface TokenEstimate {
  modelProfileId: string;
  text: string;
  tokens: number;
  contextWindowUsage?: number; // Percentage of context window used
  estimatedCost?: {
    input: number;
    currency: string;
  };
}

@Injectable()
export class TokenizerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly registry: TokenizerRegistry,
    @InjectRedis() private readonly redis: Redis,
  ) {}
  
  async estimate(modelProfileId: string, text: string): Promise<TokenEstimate> {
    // Check cache first
    const cacheKey = this.getCacheKey(modelProfileId, text);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Get model profile
    const modelProfile = await this.prisma.modelProfile.findUnique({
      where: { id: modelProfileId }
    });
    
    if (!modelProfile) {
      throw new NotFoundException('Model profile not found');
    }
    
    // Get tokenizer
    const tokenizerKey = modelProfile.tokenizer || modelProfile.name;
    const tokenizer = this.registry.get(tokenizerKey);
    
    // Count tokens
    const tokens = tokenizer.countTokens(text);
    
    // Calculate context window usage
    let contextWindowUsage: number | undefined;
    if (modelProfile.maxInputTokens) {
      contextWindowUsage = (tokens / modelProfile.maxInputTokens) * 100;
    }
    
    // Calculate estimated cost
    let estimatedCost: TokenEstimate['estimatedCost'];
    if (modelProfile.pricing && typeof modelProfile.pricing === 'object') {
      const pricing = modelProfile.pricing as any;
      if (pricing.inputPer1K) {
        estimatedCost = {
          input: (tokens / 1000) * pricing.inputPer1K,
          currency: pricing.currency || 'USD',
        };
      }
    }
    
    const result: TokenEstimate = {
      modelProfileId,
      text,
      tokens,
      contextWindowUsage,
      estimatedCost,
    };
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    
    return result;
  }
  
  async estimateBatch(
    modelProfileId: string, 
    texts: string[]
  ): Promise<TokenEstimate[]> {
    return Promise.all(texts.map(text => this.estimate(modelProfileId, text)));
  }
  
  async validateContextWindow(
    modelProfileId: string,
    promptTokens: number,
    maxOutputTokens?: number
  ): Promise<{ valid: boolean; reason?: string }> {
    const modelProfile = await this.prisma.modelProfile.findUnique({
      where: { id: modelProfileId }
    });
    
    if (!modelProfile) {
      return { valid: false, reason: 'Model profile not found' };
    }
    
    if (!modelProfile.maxInputTokens) {
      return { valid: true }; // No limit defined
    }
    
    const totalTokens = promptTokens + (maxOutputTokens || modelProfile.maxOutputTokens || 0);
    
    if (totalTokens > modelProfile.maxInputTokens) {
      return {
        valid: false,
        reason: `Total tokens (${totalTokens}) exceeds model limit (${modelProfile.maxInputTokens})`
      };
    }
    
    return { valid: true };
  }
  
  private getCacheKey(modelProfileId: string, text: string): string {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `tokenizer:${modelProfileId}:${hash}`;
  }
}
```

### 5. Create Controller

Create `/apps/api/src/tokenizer/tokenizer.controller.ts`:
```typescript
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { TypedRoute, TypedBody } from '@nestia/core';
import { TokenizerService } from './tokenizer.service';
import { tags } from 'typia';

interface EstimateDto {
  modelProfileId: string & tags.Format<"uuid">;
  text: string & tags.MinLength<1>;
}

interface BatchEstimateDto {
  modelProfileId: string & tags.Format<"uuid">;
  texts: string[] & tags.MinItems<1> & tags.MaxItems<100>;
}

@Controller('tokenize')
export class TokenizerController {
  constructor(private readonly tokenizerService: TokenizerService) {}
  
  @TypedRoute.Post('estimate')
  async estimate(@TypedBody() dto: EstimateDto) {
    return this.tokenizerService.estimate(dto.modelProfileId, dto.text);
  }
  
  @TypedRoute.Post('estimate/batch')
  async estimateBatch(@TypedBody() dto: BatchEstimateDto) {
    return this.tokenizerService.estimateBatch(dto.modelProfileId, dto.texts);
  }
  
  @TypedRoute.Post('validate')
  async validateContextWindow(
    @TypedBody() dto: {
      modelProfileId: string & tags.Format<"uuid">;
      promptTokens: number & tags.Type<"uint32">;
      maxOutputTokens?: number & tags.Type<"uint32">;
    }
  ) {
    return this.tokenizerService.validateContextWindow(
      dto.modelProfileId,
      dto.promptTokens,
      dto.maxOutputTokens
    );
  }
}
```

### 6. Add Package Dependencies

Update `/apps/api/package.json`:
```json
{
  "dependencies": {
    "tiktoken": "^1.0.22"
  }
}
```

**Note**: Using the official `tiktoken` package (not @dqbd/tiktoken) for:
- WASM implementation that's 3-6x faster than pure JS
- Active maintenance (last update within days)
- Full feature parity with OpenAI's Python implementation

## Testing Requirements

### Unit Tests
```typescript
describe('TokenizerRegistry', () => {
  it('should tokenize GPT-4 text accurately', () => {
    const tokenizer = registry.get('tiktoken:cl100k_base');
    const tokens = tokenizer.countTokens('Hello, world!');
    expect(tokens).toBe(4); // Actual count for cl100k_base
  });
  
  it('should fall back to heuristic for unknown models', () => {
    const tokenizer = registry.get('unknown-model');
    const tokens = tokenizer.countTokens('test');
    expect(tokens).toBe(1); // 4 chars / 4 = 1
  });
});
```

### Integration Tests
```typescript
describe('TokenizerService', () => {
  it('should estimate tokens with caching', async () => {
    const estimate1 = await service.estimate(modelProfileId, 'test text');
    const estimate2 = await service.estimate(modelProfileId, 'test text');
    
    expect(estimate1).toEqual(estimate2);
    // Verify redis was only called once
  });
  
  it('should validate context window limits', async () => {
    const result = await service.validateContextWindow(
      modelProfileId,
      100000, // Too many tokens
      1000
    );
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds model limit');
  });
});
```

### Accuracy Tests
```typescript
describe('Tokenizer Accuracy', () => {
  it('should be within 5% of actual API token count', async () => {
    const testCases = [
      'Simple text',
      'Complex text with punctuation! And numbers: 123',
      'Unicode: 你好世界 🌍',
    ];
    
    for (const text of testCases) {
      const estimated = await service.estimate(gpt4ModelId, text);
      const actual = await getActualTokenCount(text); // Call to OpenAI
      
      const difference = Math.abs(estimated.tokens - actual) / actual;
      expect(difference).toBeLessThan(0.05); // Within 5%
    }
  });
});
```

## Files to Modify/Create
- `/packages/db/prisma/schema.prisma` - Add tokenization fields
- `/apps/api/src/tokenizer/tokenizer.module.ts` - Module setup
- `/apps/api/src/tokenizer/tokenizer.registry.ts` - Registry implementation
- `/apps/api/src/tokenizer/tokenizer.service.ts` - Business logic
- `/apps/api/src/tokenizer/tokenizer.controller.ts` - HTTP endpoints
- `/apps/api/src/app.module.ts` - Import TokenizerModule
- `/apps/api/tests/tokenizer/` - Test directory

## Validation Commands
```bash
# Install dependencies
cd apps/api
pnpm add tiktoken

# Run migration for ModelProfile changes
cd ../../packages/db
pnpm prisma migrate dev

# Run tests
cd ../../apps/api
pnpm test tokenizer

# Test endpoint
curl -X POST http://localhost:3001/tokenize/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "modelProfileId": "...",
    "text": "This is a test of the tokenizer service"
  }'
```

## Notes
- **2024 Best Practice**: Use official `tiktoken` package for 3-6x performance improvement
- WASM implementation provides near-native performance in Node.js
- Start with tiktoken for GPT models (most accurate)
- Claude tokenizer is approximate until official SDK available
- Cache estimates to reduce computation (5-minute TTL)
- Consider batch endpoints for performance
- Future: Add streaming token counting
- Future: Support for custom/fine-tuned model tokenizers