# Ticket: 00-structural/010 - Rate Limiting Enhancement

## Priority
**High** - Critical for production deployment and cost control

## Spec Reference
- Protection against abuse and DDoS
- Cost control for AI generation
- Fair usage enforcement

## Dependencies
- 00-structural/004 (JWT Authentication) - For per-user limits

## Current State
- Basic @nestjs/throttler configuration
- IP-based rate limiting only
- No role-based limits
- No cost-based throttling

## Target State
- Per-user rate limiting (not just IP)
- Different limits per role
- Redis storage for multi-instance support
- Cost-based AI generation throttling
- Proper proxy support

## Implementation Decision (2024)
**Continue using @nestjs/throttler** - Research shows it's the best choice for NestJS:
- Native integration with guards and decorators
- Supports Redis storage for distributed systems
- Flexible configuration for different endpoints
- Active maintenance and community support

## Acceptance Criteria
- [ ] Per-user rate limiting implemented
- [ ] Role-based limits (OWNER: higher, READER: lower)
- [ ] Redis storage configured for multi-instance
- [ ] AI generation has cost-based throttling
- [ ] Proxy support (X-Forwarded-For) enabled
- [ ] Auth endpoints have stricter limits
- [ ] Rate limit headers in responses
- [ ] Tests cover rate limiting scenarios

## Implementation Steps

### 1. Install Redis Storage Provider

```bash
cd apps/api
pnpm add @nestjs-modules/ioredis nestjs-throttler-storage-redis
```

### 2. Configure Enhanced Throttler

Update `/apps/api/src/app.module.ts`:
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: seconds(1),
            limit: 10, // 10 requests per second
          },
          {
            name: 'medium',
            ttl: seconds(60),
            limit: 100, // 100 requests per minute
          },
          {
            name: 'long',
            ttl: hours(1),
            limit: 1000, // 1000 requests per hour
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get('REDIS_HOST'),
            port: config.get('REDIS_PORT'),
          })
        ),
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 3. Create User-Based Throttler Guard

Create `/apps/api/src/guards/user-throttler.guard.ts`:
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected reflector: Reflector,
    protected options: any,
    protected storageService: any
  ) {
    super(options, storageService, reflector);
  }

  async getTracker(req: ThrottlerRequest): Promise<string> {
    const user = req.user;
    
    // If authenticated, use user ID for tracking
    if (user?.id) {
      return `user:${user.id}`;
    }
    
    // Fall back to IP for unauthenticated requests
    // Handle proxy headers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return `ip:${forwarded.split(',')[0]}`;
    }
    
    return `ip:${req.ip}`;
  }

  async getLimit(context: ExecutionContext, key: string): Promise<number> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    
    // Get base limit from decorator or default
    const baseLimit = await super.getLimit(context, key);
    
    // Adjust based on user role
    if (!user) return baseLimit;
    
    switch (user.role) {
      case 'OWNER':
        return baseLimit * 3; // 3x limit for owners
      case 'MAINTAINER':
        return baseLimit * 2; // 2x limit for maintainers
      case 'WRITER':
        return baseLimit * 1.5; // 1.5x limit for writers
      case 'READER':
        return baseLimit; // Standard limit for readers
      default:
        return baseLimit;
    }
  }
}
```

### 4. Create AI Generation Throttler

Create `/apps/api/src/guards/ai-throttler.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AIThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    protected reflector: Reflector,
    protected options: any,
    protected storageService: any
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    
    if (!user) return false;
    
    // Check token usage for the day
    const today = new Date().toISOString().split('T')[0];
    const tokenKey = `tokens:${user.id}:${today}`;
    const tokensUsed = parseInt(await this.redis.get(tokenKey) || '0');
    
    // Get user's daily limit based on plan/role
    const dailyLimit = this.getDailyTokenLimit(user);
    
    if (tokensUsed >= dailyLimit) {
      throw new TooManyRequestsException({
        message: 'Daily AI token limit exceeded',
        retryAfter: this.getSecondsUntilMidnight(),
        tokensUsed,
        dailyLimit,
      });
    }
    
    // Also check standard rate limits
    return super.canActivate(context);
  }
  
  private getDailyTokenLimit(user: any): number {
    // These would come from database/config in production
    const limits = {
      OWNER: 3_000_000,
      MAINTAINER: 1_000_000,
      WRITER: 500_000,
      READER: 0, // Readers can't use AI
    };
    
    return limits[user.role] || 0;
  }
  
  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }
}
```

### 5. Apply Different Limits to Endpoints

Update controllers:
```typescript
// Auth endpoints - stricter limits
@Controller('auth')
export class AuthController {
  @Public()
  @Throttle({ short: { limit: 3, ttl: 1 } }) // 3 per second
  @Post('login')
  async login() { /* ... */ }
  
  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60 } }) // 5 per minute
  @Post('register')
  async register() { /* ... */ }
}

// AI generation - cost-based limits
@Controller('generate')
export class GenerationController {
  @UseGuards(AIThrottlerGuard)
  @Throttle({ medium: { limit: 10, ttl: 60 } }) // 10 per minute
  @Post()
  async generate() { /* ... */ }
}

// Regular endpoints - standard limits
@Controller('scenes')
export class ScenesController {
  // Uses default limits from AppModule
  @Get()
  async findAll() { /* ... */ }
}
```

### 6. Add Rate Limit Headers

Create interceptor `/apps/api/src/interceptors/rate-limit-headers.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RateLimitHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();
        
        // These would be calculated based on actual limits
        response.setHeader('X-RateLimit-Limit', '100');
        response.setHeader('X-RateLimit-Remaining', '95');
        response.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
      })
    );
  }
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('UserThrottlerGuard', () => {
  it('should use user ID for authenticated requests', async () => {
    const tracker = await guard.getTracker({ user: { id: 'user123' } });
    expect(tracker).toBe('user:user123');
  });
  
  it('should apply role-based multipliers', async () => {
    const ownerLimit = await guard.getLimit(ownerContext, 'medium');
    const readerLimit = await guard.getLimit(readerContext, 'medium');
    expect(ownerLimit).toBe(readerLimit * 3);
  });
});
```

### Integration Tests
```typescript
describe('Rate Limiting', () => {
  it('should enforce per-user limits', async () => {
    // Make requests up to limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/scenes').set('Authorization', `Bearer ${token}`);
    }
    
    // Next request should be rate limited
    const response = await request(app)
      .get('/scenes')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(429);
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
  });
  
  it('should enforce stricter limits on auth endpoints', async () => {
    // Only 5 registration attempts per minute
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/register').send(userData);
    }
    
    const response = await request(app).post('/auth/register').send(userData);
    expect(response.status).toBe(429);
  });
});
```

## Files to Create/Modify
- `/apps/api/src/app.module.ts` - Configure Redis storage
- `/apps/api/src/guards/user-throttler.guard.ts` - User-based tracking
- `/apps/api/src/guards/ai-throttler.guard.ts` - Token usage limits
- `/apps/api/src/interceptors/rate-limit-headers.interceptor.ts` - Response headers
- All controllers - Apply appropriate limits
- `/apps/api/tests/rate-limiting.test.ts` - Comprehensive tests

## Validation Commands
```bash
# Install dependencies
cd apps/api
pnpm add @nestjs-modules/ioredis nestjs-throttler-storage-redis

# Run tests
pnpm test rate-limiting

# Test rate limiting
for i in {1..15}; do
  curl http://localhost:3001/scenes \
    -H "Authorization: Bearer $TOKEN"
done
# Should get 429 after limit

# Check headers
curl -I http://localhost:3001/scenes \
  -H "Authorization: Bearer $TOKEN"
# Should see X-RateLimit-* headers
```

## Notes
- **2024 Best Practice**: @nestjs/throttler with Redis storage for distributed systems
- Use proxy trust settings in production (`app.set('trust proxy', true)`)
- Monitor rate limit metrics to adjust limits
- Consider implementing sliding window algorithm for smoother limits
- Future: Add websocket rate limiting
- Future: Implement cost-based billing integration
- Cache user limits to avoid database lookups on every request