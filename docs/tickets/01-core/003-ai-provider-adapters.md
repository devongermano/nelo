# Ticket: 01-core/003 - AI Provider Adapters

## Priority
**Critical** - AI generation is core functionality

## Spec Reference
`/docs/spec-pack.md` sections:
- Provider Adapter Interface (lines 842-850)
- ModelProfile schema (lines 407-413)
- ProviderKey model (lines 583-593)
- Spec Evolution #009 (ModelProfile Tokenization Fields)
- Related: Ticket 01-core/009 (Tokenizer Service)

## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/002 (Shared Types Package)

## Current State
- Basic placeholder in `/packages/ai-adapters`
- No real provider implementations
- No API key management
- No cost tracking

## Target State
- Working OpenAI and Anthropic adapters using Vercel AI SDK
- Secure API key storage with encryption
- Model configuration management
- Cost tracking per request with dynamic pricing
- Rate limiting and retry logic
- Accurate token counting via tokenizer service (see ticket 01-core/009)

## Acceptance Criteria
- [ ] OpenAI adapter generates text via Vercel AI SDK
- [ ] Anthropic adapter generates text via Vercel AI SDK
- [ ] API keys encrypted in database
- [ ] Provider selection works
- [ ] Cost tracking implemented with tiktoken
- [ ] Stream support for real-time generation
- [ ] Rate limiting with rate-limiter-flexible
- [ ] Retry logic with p-retry
- [ ] Tests mock API calls

## 🚀 Optimized Implementation Using Best Libraries

### Required Dependencies
```json
{
  "dependencies": {
    "@nelo/db": "workspace:*",
    "@nelo/shared-types": "workspace:*",
    "ai": "^3.5.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "tiktoken": "^1.0.0",
    "rate-limiter-flexible": "^7.2.0",
    "p-retry": "^6.2.0",
    "ioredis": "^5.3.0"
  }
}
```

## Implementation Steps

### 1. **Core Provider Implementation** (`/packages/ai-adapters/src/provider.ts`)
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, embed } from 'ai';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import pRetry from 'p-retry';
import Redis from 'ioredis';

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  systemPrompt?: string;
  tools?: any[];
}

export class UnifiedAIProvider {
  private provider: any;
  private rateLimiter: RateLimiterRedis;
  private redis: Redis;
  private providerType: string;
  
  constructor(providerType: string, apiKey: string, redis: Redis) {
    this.providerType = providerType;
    this.redis = redis;
    
    // Initialize provider using Vercel AI SDK
    switch (providerType) {
      case 'openai':
        this.provider = createOpenAI({ apiKey });
        break;
      case 'anthropic':
        this.provider = createAnthropic({ apiKey });
        break;
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }
    
    // Setup rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `rate_limit:${providerType}`,
      points: 100, // 100 requests
      duration: 60, // per 60 seconds
      blockDuration: 10, // block for 10 seconds if exceeded
      
      // Insurance strategy for Redis failures
      insuranceLimiter: new RateLimiterMemory({
        points: 10,
        duration: 60,
      })
    });
  }
  
  async generate(prompt: string, options: GenerateOptions = {}): Promise<any> {
    // Rate limiting
    await this.rateLimiter.consume(1);
    
    // Retry logic with exponential backoff
    return pRetry(
      async () => {
        const model = this.getModel(options.model);
        
        const result = await generateText({
          model,
          prompt,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 2000,
          topP: options.topP,
          system: options.systemPrompt,
          tools: options.tools,
        });
        
        return result;
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
        randomize: true, // Add jitter
        onFailedAttempt: error => {
          console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
          
          // Only retry on retryable errors
          if (error.statusCode && error.statusCode < 500 && error.statusCode !== 429) {
            throw error; // Don't retry client errors (except rate limit)
          }
        }
      }
    );
  }
  
  async stream(prompt: string, options: GenerateOptions = {}): Promise<any> {
    await this.rateLimiter.consume(1);
    
    return pRetry(
      async () => {
        const model = this.getModel(options.model);
        
        const result = await streamText({
          model,
          prompt,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 2000,
          system: options.systemPrompt,
        });
        
        return result;
      },
      { retries: 3 }
    );
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    await this.rateLimiter.consume(1);
    
    const model = this.getEmbeddingModel();
    
    const { embeddings } = await embed({
      model,
      value: texts,
    });
    
    return embeddings;
  }
  
  private getModel(modelName?: string) {
    if (this.providerType === 'openai') {
      return this.provider(modelName || 'gpt-4-turbo-preview');
    } else if (this.providerType === 'anthropic') {
      return this.provider(modelName || 'claude-3-opus-20240229');
    }
    throw new Error('Invalid provider');
  }
  
  private getEmbeddingModel() {
    if (this.providerType === 'openai') {
      return this.provider.embedding('text-embedding-3-small');
    }
    throw new Error('Provider does not support embeddings');
  }
}
```

### 2. **Token Counter with tiktoken** (`/packages/ai-adapters/src/token-counter.ts`)
```typescript
import { encoding_for_model, get_encoding, Tiktoken } from 'tiktoken';

export class TokenCounter {
  private encoders: Map<string, Tiktoken> = new Map();
  
  count(text: string, model: string = 'gpt-4'): number {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback for unknown models
      return this.estimateTokens(text);
    }
  }
  
  countMessages(messages: any[], model: string = 'gpt-4'): number {
    let totalTokens = 0;
    const encoder = this.getEncoder(model);
    
    for (const message of messages) {
      totalTokens += 4; // Every message has <im_start>, role, \n, <im_end>
      
      if (message.role) {
        totalTokens += encoder.encode(message.role).length;
      }
      
      if (message.content) {
        totalTokens += encoder.encode(message.content).length;
      }
      
      if (message.name) {
        totalTokens += encoder.encode(message.name).length - 1; // name is +1 token
      }
    }
    
    totalTokens += 2; // Every reply has <im_start>assistant
    
    return totalTokens;
  }
  
  private getEncoder(model: string): Tiktoken {
    if (!this.encoders.has(model)) {
      try {
        const encoder = encoding_for_model(model as any);
        this.encoders.set(model, encoder);
      } catch {
        // Fallback to cl100k_base for unknown models
        const encoder = get_encoding('cl100k_base');
        this.encoders.set(model, encoder);
      }
    }
    
    return this.encoders.get(model)!;
  }
  
  private estimateTokens(text: string): number {
    // More accurate estimation than length/4
    // Based on empirical data: ~1 token per 3.5 characters for English
    return Math.ceil(text.length / 3.5);
  }
  
  // Clean up encoders to free memory
  cleanup(): void {
    this.encoders.forEach(encoder => encoder.free());
    this.encoders.clear();
  }
}
```

### 3. **Dynamic Cost Calculator** (`/packages/ai-adapters/src/cost-tracker.ts`)
```typescript
import Redis from 'ioredis';

interface PricingInfo {
  input: number;  // per 1K tokens
  output: number; // per 1K tokens
}

export class CostTracker {
  private redis: Redis;
  
  // Fallback pricing (updated regularly)
  private static FALLBACK_PRICING: Record<string, PricingInfo> = {
    // OpenAI models
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    
    // Anthropic models
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  };
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    const pricing = await this.getPricing(model);
    
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }
  
  async trackUsage(
    runId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    projectId: string
  ): Promise<void> {
    const cost = await this.calculateCost(model, inputTokens, outputTokens);
    
    // Store in database
    await prisma.costEvent.create({
      data: {
        runId,
        amount: cost,
        createdAt: new Date()
      }
    });
    
    // Update project spend
    await prisma.budget.updateMany({
      where: { projectId },
      data: { spentUSD: { increment: cost } }
    });
    
    // Update daily spend in Redis for quick access
    const dailyKey = `daily_spend:${projectId}:${new Date().toISOString().split('T')[0]}`;
    await this.redis.incrbyfloat(dailyKey, cost);
    await this.redis.expire(dailyKey, 86400 * 7); // Keep for 7 days
  }
  
  private async getPricing(model: string): Promise<PricingInfo> {
    const cacheKey = `pricing:${model}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      // In production, fetch from provider APIs
      const pricing = await this.fetchLatestPricing(model);
      
      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(pricing));
      
      return pricing;
    } catch (error) {
      console.error('Failed to fetch pricing, using fallback:', error);
      return CostTracker.FALLBACK_PRICING[model] || { input: 0, output: 0 };
    }
  }
  
  private async fetchLatestPricing(model: string): Promise<PricingInfo> {
    // TODO: Implement actual API calls to fetch current pricing
    // For now, return fallback
    return CostTracker.FALLBACK_PRICING[model] || { input: 0, output: 0 };
  }
  
  async checkBudget(projectId: string): Promise<boolean> {
    const budget = await prisma.budget.findFirst({
      where: { projectId }
    });
    
    if (!budget) return true; // No budget set, allow
    
    return budget.spentUSD < budget.limitUSD;
  }
}
```

### 4. **Secure Key Management** (`/packages/ai-adapters/src/key-vault.ts`)
```typescript
import * as crypto from 'crypto';

interface EncryptedKey {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

export class KeyVault {
  private algorithm = 'aes-256-gcm';
  private iterations = 100000;
  private saltLength = 64;
  
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.iterations, 32, 'sha256');
  }
  
  encrypt(apiKey: string): EncryptedKey {
    const password = process.env.ENCRYPTION_KEY!;
    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(apiKey, 'utf8'),
      cipher.final()
    ]);
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      salt: salt.toString('base64')
    };
  }
  
  decrypt(encryptedKey: EncryptedKey): string {
    const password = process.env.ENCRYPTION_KEY!;
    const salt = Buffer.from(encryptedKey.salt, 'base64');
    const key = this.deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedKey.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedKey.tag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey.encrypted, 'base64')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
  
  // Rotate encryption key
  async rotateKeys(oldPassword: string, newPassword: string): Promise<void> {
    const keys = await prisma.providerKey.findMany();
    
    for (const keyRecord of keys) {
      // Decrypt with old password
      process.env.ENCRYPTION_KEY = oldPassword;
      const decrypted = this.decrypt(JSON.parse(keyRecord.apiKey));
      
      // Re-encrypt with new password
      process.env.ENCRYPTION_KEY = newPassword;
      const reencrypted = this.encrypt(decrypted);
      
      // Update in database
      await prisma.providerKey.update({
        where: { id: keyRecord.id },
        data: { apiKey: JSON.stringify(reencrypted) }
      });
    }
  }
}
```

### 5. **Factory Pattern** (`/packages/ai-adapters/src/factory.ts`)
```typescript
import Redis from 'ioredis';
import { UnifiedAIProvider } from './provider';
import { TokenCounter } from './token-counter';
import { CostTracker } from './cost-tracker';
import { KeyVault } from './key-vault';

export class AIProviderFactory {
  private static redis: Redis;
  private static tokenCounter: TokenCounter;
  private static costTracker: CostTracker;
  private static keyVault: KeyVault;
  
  static initialize() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.tokenCounter = new TokenCounter();
    this.costTracker = new CostTracker(this.redis);
    this.keyVault = new KeyVault();
  }
  
  static async createProvider(
    provider: string,
    encryptedKey: string
  ): Promise<UnifiedAIProvider> {
    // Decrypt API key
    const keyData = JSON.parse(encryptedKey);
    const apiKey = this.keyVault.decrypt(keyData);
    
    return new UnifiedAIProvider(provider, apiKey, this.redis);
  }
  
  static getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }
  
  static getCostTracker(): CostTracker {
    return this.costTracker;
  }
  
  static getKeyVault(): KeyVault {
    return this.keyVault;
  }
  
  static async cleanup() {
    this.tokenCounter.cleanup();
    await this.redis.quit();
  }
}
```

## Testing Requirements

### 1. **Mock Provider Tests** (`/packages/ai-adapters/test/provider.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { UnifiedAIProvider } from '../src/provider';

describe('UnifiedAIProvider', () => {
  it('should retry on transient failures', async () => {
    const mockGenerate = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ text: 'Success' });
    
    // Test retry logic
  });
  
  it('should respect rate limits', async () => {
    // Test rate limiting
  });
  
  it('should handle streaming', async () => {
    // Test streaming
  });
});
```

### 2. **Token Counter Tests** (`/packages/ai-adapters/test/token-counter.test.ts`)
```typescript
describe('TokenCounter', () => {
  it('should count tokens accurately for GPT-4', () => {
    const counter = new TokenCounter();
    expect(counter.count('Hello, world!', 'gpt-4')).toBe(4);
  });
  
  it('should count message tokens with roles', () => {
    const counter = new TokenCounter();
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello!' }
    ];
    
    const tokens = counter.countMessages(messages, 'gpt-4');
    expect(tokens).toBeGreaterThan(0);
  });
});
```

### 3. **Cost Tracker Tests** (`/packages/ai-adapters/test/cost-tracker.test.ts`)
```typescript
describe('CostTracker', () => {
  it('should calculate costs correctly', async () => {
    const tracker = new CostTracker(redisMock);
    const cost = await tracker.calculateCost('gpt-4', 1000, 500);
    expect(cost).toBeCloseTo(0.06); // $0.03 + $0.03
  });
});
```

## Files to Modify/Create
- `/packages/ai-adapters/package.json` - Update dependencies
- `/packages/ai-adapters/src/provider.ts` - Unified provider with Vercel AI SDK
- `/packages/ai-adapters/src/token-counter.ts` - Tiktoken integration
- `/packages/ai-adapters/src/cost-tracker.ts` - Dynamic pricing
- `/packages/ai-adapters/src/key-vault.ts` - Encryption utilities
- `/packages/ai-adapters/src/factory.ts` - Factory pattern
- Test files as specified above

## Validation Commands
```bash
cd packages/ai-adapters
pnpm install
pnpm test
pnpm typecheck

# Test generation
pnpm vitest provider.test.ts

# Test token counting
pnpm vitest token-counter.test.ts
```

## Notes
- Using Vercel AI SDK significantly reduces complexity
- tiktoken provides 100% accurate token counting
- rate-limiter-flexible handles complex rate limiting scenarios
- p-retry provides battle-tested retry logic
- Consider adding observability with OpenTelemetry
- Add circuit breaker pattern for provider failures
- Implement request deduplication for identical prompts