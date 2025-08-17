# Ticket: 00-structural/013 - Logging & Monitoring Infrastructure

## Priority
**High** - Essential for production observability

## Spec Reference
- Production readiness
- Debugging capabilities
- Performance monitoring

## Dependencies
- 00-structural/012 (Error Handling) - For error tracking

## Current State
- Basic console.log statements
- No structured logging
- No performance monitoring
- No health checks

## Target State
- Structured JSON logging
- Request/response logging
- Performance metrics
- Health check endpoints
- APM integration

## Acceptance Criteria
- [ ] Structured logging with winston/pino
- [ ] Request ID propagation
- [ ] Performance metrics collection
- [ ] Health check endpoints
- [ ] Log levels properly configured
- [ ] Sensitive data never logged
- [ ] Log aggregation ready

## Implementation Steps

### 1. Install Dependencies

```bash
cd apps/api
pnpm add winston winston-daily-rotate-file
pnpm add @nestjs/terminus
```

### 2. Create Logger Service

Create `/apps/api/src/logger/logger.service.ts`:
```typescript
import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;
  
  constructor() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        // Scrub sensitive data
        const sanitized = this.sanitizeLog(meta);
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...sanitized,
        });
      })
    );
    
    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ];
    
    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: logFormat,
        }),
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: logFormat,
        })
      );
    }
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports,
      defaultMeta: {
        service: 'nelo-api',
        environment: process.env.NODE_ENV,
      },
    });
  }
  
  log(message: string, context?: any) {
    this.logger.info(message, { context });
  }
  
  error(message: string, trace?: string, context?: any) {
    this.logger.error(message, { trace, context });
  }
  
  warn(message: string, context?: any) {
    this.logger.warn(message, { context });
  }
  
  debug(message: string, context?: any) {
    this.logger.debug(message, { context });
  }
  
  verbose(message: string, context?: any) {
    this.logger.verbose(message, { context });
  }
  
  private sanitizeLog(data: any): any {
    if (!data) return data;
    
    const sensitiveKeys = [
      'password', 'token', 'secret', 'apiKey',
      'authorization', 'cookie', 'creditCard'
    ];
    
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const key in obj) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          result[key] = sanitize(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
      
      return result;
    };
    
    return sanitize(data);
  }
}
```

### 3. Create Request Logger Middleware

Create `/apps/api/src/middleware/request-logger.middleware.ts`:
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private logger: CustomLoggerService) {}
  
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.id = requestId;
    
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;
    
    // Log request
    this.logger.log('Incoming request', {
      requestId,
      method,
      url: originalUrl,
      ip,
      userAgent: headers['user-agent'],
      userId: (req as any).user?.id,
    });
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      
      this.logger.log('Request completed', {
        requestId,
        method,
        url: originalUrl,
        statusCode,
        duration,
        userId: (req as any).user?.id,
      });
      
      // Log slow requests
      if (duration > 1000) {
        this.logger.warn('Slow request detected', {
          requestId,
          url: originalUrl,
          duration,
        });
      }
      
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      return originalSend.call(this, data);
    }.bind(res);
    
    next();
  }
}
```

### 4. Create Health Check Module

Create `/apps/api/src/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    @InjectRedis() private redis: Redis,
  ) {}
  
  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health
      () => this.prisma.pingCheck('database'),
      
      // Redis health
      () => this.checkRedis(),
      
      // Memory health (max 500MB heap)
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
      
      // Disk health (min 10% free)
      () => this.disk.checkStorage('storage', {
        threshold: 10 * 1024 * 1024 * 1024, // 10GB
        path: '/',
      }),
    ]);
  }
  
  @Get('ready')
  @Public()
  ready() {
    // Kubernetes readiness probe
    return { status: 'ready' };
  }
  
  @Get('live')
  @Public()
  live() {
    // Kubernetes liveness probe
    return { status: 'alive' };
  }
  
  private async checkRedis() {
    try {
      await this.redis.ping();
      return {
        redis: {
          status: 'up',
        },
      };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error.message,
        },
      };
    }
  }
}
```

### 5. Create Metrics Interceptor

Create `/apps/api/src/interceptors/metrics.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(@InjectRedis() private redis: Redis) {}
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    
    return next.handle().pipe(
      tap(async () => {
        const duration = Date.now() - startTime;
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        
        // Record metrics in Redis
        const metricsKey = `metrics:${method}:${this.normalizeUrl(url)}`;
        const hourKey = `${metricsKey}:${new Date().getHours()}`;
        
        await this.redis.multi()
          .hincrby(hourKey, 'count', 1)
          .hincrby(hourKey, 'totalTime', duration)
          .hincrby(hourKey, `status_${statusCode}`, 1)
          .expire(hourKey, 3600 * 24) // Keep for 24 hours
          .exec();
        
        // Track slow queries
        if (duration > 1000) {
          await this.redis.zadd(
            'slow_requests',
            Date.now(),
            JSON.stringify({ method, url, duration, timestamp: new Date() })
          );
        }
      }),
    );
  }
  
  private normalizeUrl(url: string): string {
    // Replace IDs with placeholders for grouping
    return url
      .replace(/\/[a-f0-9-]{36}/g, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id'); // Numeric IDs
  }
}
```

### 6. Create Metrics Endpoint

```typescript
@Controller('metrics')
export class MetricsController {
  constructor(@InjectRedis() private redis: Redis) {}
  
  @Get()
  @Public()
  async getMetrics() {
    const keys = await this.redis.keys('metrics:*');
    const metrics: any = {};
    
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      const [, method, url, hour] = key.split(':');
      
      if (!metrics[`${method} ${url}`]) {
        metrics[`${method} ${url}`] = {};
      }
      
      metrics[`${method} ${url}`][hour] = {
        count: parseInt(data.count || '0'),
        avgTime: parseInt(data.totalTime || '0') / parseInt(data.count || '1'),
        status: Object.keys(data)
          .filter(k => k.startsWith('status_'))
          .reduce((acc, k) => {
            acc[k.replace('status_', '')] = parseInt(data[k]);
            return acc;
          }, {}),
      };
    }
    
    return metrics;
  }
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('CustomLoggerService', () => {
  it('should sanitize sensitive data', () => {
    const logger = new CustomLoggerService();
    const sanitized = logger['sanitizeLog']({
      user: 'john',
      password: 'secret',
      apiKey: 'key123',
    });
    
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.user).toBe('john');
  });
});

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.info.database.status).toBe('up');
  });
});
```

## Files to Create/Modify
- `/apps/api/src/logger/logger.service.ts` - Custom logger
- `/apps/api/src/middleware/request-logger.middleware.ts` - Request logging
- `/apps/api/src/health/health.controller.ts` - Health checks
- `/apps/api/src/interceptors/metrics.interceptor.ts` - Metrics collection
- `/apps/api/src/metrics/metrics.controller.ts` - Metrics endpoint
- `/apps/api/src/app.module.ts` - Register modules

## Validation Commands
```bash
# Install dependencies
cd apps/api
pnpm add winston winston-daily-rotate-file @nestjs/terminus

# Check health endpoint
curl http://localhost:3001/health

# Check metrics
curl http://localhost:3001/metrics

# Verify logging
tail -f logs/app-*.log

# Test slow request logging
curl http://localhost:3001/slow-endpoint
# Check logs for slow request warning
```

## Notes
- Use structured logging for better searchability
- Never log sensitive data (passwords, tokens, etc.)
- Include request IDs for tracing
- Monitor slow requests and errors
- Consider log aggregation (ELK stack, DataDog)
- Future: Add distributed tracing (OpenTelemetry)
- Future: Add custom business metrics
- Future: Integrate with APM tools