# Ticket: 00-structural/011 - Caching Strategy

## Priority
**Medium** - Performance optimization, not blocking core features

## Spec Reference
- Performance optimization
- Reduce database load
- Improve response times

## Dependencies
- Redis infrastructure (already in place)
- 00-structural/004 (JWT Authentication) - For user-specific caching

## Current State
- Redis used for WebSocket presence
- No systematic caching strategy
- Database queries not cached
- AI responses not cached

## Target State
- Comprehensive caching layer
- Cache invalidation strategy
- Permission checks cached
- Context compositions cached
- Token estimates cached
- Database query results cached

## Acceptance Criteria
- [ ] Cache interceptor for GET requests
- [ ] Permission checks use Redis cache
- [ ] Context compositions are cached
- [ ] Token estimates are cached
- [ ] Cache invalidation on mutations
- [ ] Cache metrics and monitoring
- [ ] Tests verify cache behavior

## Implementation Steps

### 1. Create Cache Module

Create `/apps/api/src/cache/cache.module.ts`:
```typescript
import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Global()
@Module({
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService],
})
export class CacheModule {}
```

### 2. Create Cache Service

Create `/apps/api/src/cache/cache.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  tags?: string[]; // Tags for invalidation
}

@Injectable()
export class CacheService {
  private readonly DEFAULT_TTL = 300; // 5 minutes
  
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}
  
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    if (!cached) return null;
    
    try {
      return JSON.parse(cached);
    } catch {
      return cached as T;
    }
  }
  
  /**
   * Set cached value with optional TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const serialized = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
    
    await this.redis.setex(key, ttl, serialized);
  }
  
  /**
   * Delete cached value(s)
   */
  async delete(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.delete(`*:tag:${tag}:*`);
    }
  }
  
  /**
   * Generate cache key from parts
   */
  generateKey(...parts: any[]): string {
    return parts
      .map(p => typeof p === 'object' ? this.hash(p) : p)
      .join(':');
  }
  
  /**
   * Cache wrapper for async functions
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function
    const result = await fn();
    
    // Cache result
    await this.set(key, result, ttl);
    
    return result;
  }
  
  /**
   * Decorator for caching method results
   */
  Cache(options: CacheOptions = {}) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const cacheService = this.cacheService || this.cache;
        if (!cacheService) {
          return originalMethod.apply(this, args);
        }
        
        const key = options.key || cacheService.generateKey(
          target.constructor.name,
          propertyName,
          ...args
        );
        
        return cacheService.wrap(
          key,
          () => originalMethod.apply(this, args),
          options.ttl
        );
      };
      
      return descriptor;
    };
  }
  
  private hash(obj: any): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(obj))
      .digest('hex')
      .substring(0, 8);
  }
}
```

### 3. Create Cache Interceptor

Create `/apps/api/src/cache/cache.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { Reflector } from '@nestjs/core';

export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}
  
  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }
    
    // Get cache configuration from decorators
    const cacheKey = this.reflector.get<string>(CACHE_KEY, context.getHandler());
    const cacheTTL = this.reflector.get<number>(CACHE_TTL, context.getHandler());
    
    if (!cacheKey) {
      return next.handle();
    }
    
    // Generate full cache key including user context
    const fullKey = this.generateCacheKey(cacheKey, request);
    
    // Check cache
    const cached = await this.cacheService.get(fullKey);
    if (cached) {
      return of(cached);
    }
    
    // Execute and cache result
    return next.handle().pipe(
      tap(async (data) => {
        await this.cacheService.set(fullKey, data, cacheTTL);
      })
    );
  }
  
  private generateCacheKey(baseKey: string, request: any): string {
    const user = request.user;
    const query = JSON.stringify(request.query || {});
    const params = JSON.stringify(request.params || {});
    
    const parts = [baseKey];
    
    if (user?.id) {
      parts.push(`user:${user.id}`);
    }
    
    if (query !== '{}') {
      parts.push(`query:${this.cacheService['hash'](query)}`);
    }
    
    if (params !== '{}') {
      parts.push(`params:${params}`);
    }
    
    return parts.join(':');
  }
}
```

### 4. Create Cache Decorators

Create `/apps/api/src/cache/cache.decorators.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const CacheKey = (key: string) => SetMetadata('cache_key', key);
export const CacheTTL = (ttl: number) => SetMetadata('cache_ttl', ttl);
```

### 5. Apply Caching to Services

Update services to use caching:
```typescript
// Scenes Service
@Injectable()
export class ScenesService {
  constructor(
    private prisma: ExtendedPrismaClient,
    private cache: CacheService,
  ) {}
  
  async findOne(id: string): Promise<Scene> {
    return this.cache.wrap(
      `scene:${id}`,
      () => this.prisma.scene.findUnique({ where: { id } }),
      600 // 10 minutes
    );
  }
  
  async findAll(projectId: string): Promise<Scene[]> {
    return this.cache.wrap(
      `scenes:project:${projectId}`,
      () => this.prisma.scene.findMany({ where: { projectId } }),
      300 // 5 minutes
    );
  }
  
  async update(id: string, data: any): Promise<Scene> {
    const result = await this.prisma.scene.update({
      where: { id },
      data,
    });
    
    // Invalidate caches
    await this.cache.delete(`scene:${id}`);
    await this.cache.delete(`scenes:project:${result.projectId}`);
    
    return result;
  }
}

// Context Service
@Injectable()
export class ContextService {
  constructor(private cache: CacheService) {}
  
  async composeContext(sceneId: string, options: any): Promise<string> {
    const cacheKey = this.cache.generateKey('context', sceneId, options);
    
    return this.cache.wrap(
      cacheKey,
      async () => {
        // Expensive context composition logic
        const context = await this.buildContext(sceneId, options);
        return context;
      },
      1800 // 30 minutes
    );
  }
}
```

### 6. Apply to Controllers

```typescript
@Controller('scenes')
@UseInterceptors(CacheInterceptor)
export class ScenesController {
  @Get(':id')
  @CacheKey('scene')
  @CacheTTL(600)
  async findOne(@Param('id') id: string) {
    return this.scenesService.findOne(id);
  }
  
  @Get()
  @CacheKey('scenes')
  @CacheTTL(300)
  async findAll(@Query('projectId') projectId: string) {
    return this.scenesService.findAll(projectId);
  }
}
```

### 7. Cache Warming Strategy

Create a cache warming service:
```typescript
@Injectable()
export class CacheWarmingService {
  constructor(
    private cache: CacheService,
    private prisma: PrismaClient,
  ) {}
  
  @Cron('0 */15 * * * *') // Every 15 minutes
  async warmFrequentlyAccessedData() {
    // Warm project data for active users
    const activeProjects = await this.prisma.project.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 3600000), // Last hour
        },
      },
      take: 100,
    });
    
    for (const project of activeProjects) {
      await this.cache.set(
        `project:${project.id}`,
        project,
        900 // 15 minutes
      );
    }
  }
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('CacheService', () => {
  it('should cache and retrieve values', async () => {
    await cacheService.set('test:key', { data: 'value' }, 60);
    const cached = await cacheService.get('test:key');
    expect(cached).toEqual({ data: 'value' });
  });
  
  it('should invalidate by pattern', async () => {
    await cacheService.set('user:1:data', 'data1', 60);
    await cacheService.set('user:2:data', 'data2', 60);
    
    await cacheService.delete('user:1:*');
    
    expect(await cacheService.get('user:1:data')).toBeNull();
    expect(await cacheService.get('user:2:data')).toBe('data2');
  });
});
```

### Integration Tests
```typescript
describe('Cache Interceptor', () => {
  it('should cache GET requests', async () => {
    // First request hits database
    const response1 = await request(app).get('/scenes/123');
    
    // Second request should be cached
    const response2 = await request(app).get('/scenes/123');
    
    expect(response2.headers['x-cache']).toBe('HIT');
  });
  
  it('should invalidate cache on updates', async () => {
    await request(app).get('/scenes/123'); // Cache it
    
    await request(app)
      .patch('/scenes/123')
      .send({ contentMd: 'Updated' });
    
    const response = await request(app).get('/scenes/123');
    expect(response.body.contentMd).toBe('Updated');
  });
});
```

## Files to Create/Modify
- `/apps/api/src/cache/cache.module.ts` - Cache module
- `/apps/api/src/cache/cache.service.ts` - Core caching logic
- `/apps/api/src/cache/cache.interceptor.ts` - HTTP caching
- `/apps/api/src/cache/cache.decorators.ts` - Cache decorators
- `/apps/api/src/cache/cache-warming.service.ts` - Cache warming
- Services - Add cache logic
- Controllers - Apply cache decorators
- `/apps/api/tests/cache.test.ts` - Cache tests

## Validation Commands
```bash
# Run tests
cd apps/api
pnpm test cache

# Monitor cache hit rate
redis-cli
> INFO stats
# Check keyspace_hits vs keyspace_misses

# Check cached keys
redis-cli
> KEYS *

# Test cache behavior
curl http://localhost:3001/scenes/123
# First request: slower
curl http://localhost:3001/scenes/123
# Second request: faster (cached)
```

## Notes
- **2024 Best Practice**: Redis for distributed caching with proper TTL management
- Use cache tags for efficient invalidation
- Monitor cache hit rates (target >80% for read-heavy endpoints)
- Be careful with user-specific caching (memory usage)
- Consider cache stampede protection for popular keys
- Future: Implement cache statistics endpoint
- Future: Add cache preloading for new users
- Future: Implement partial cache invalidation