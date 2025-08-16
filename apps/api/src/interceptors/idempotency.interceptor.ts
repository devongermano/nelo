import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException, Inject, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import Redis from 'ioredis';

export const IDEMPOTENCY_REDIS = 'IDEMPOTENCY_REDIS';

interface CachedResponse {
  statusCode: number;
  data: any;
  headers?: Record<string, string>;
  timestamp: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly TTL = 60 * 60; // 1 hour

  constructor(@Inject(IDEMPOTENCY_REDIS) private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    
    const idempotencyKey = request.headers['x-idempotency-key'];
    
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new BadRequestException('X-Idempotency-Key header required');
    }

    // Create a unique key based on the idempotency key and request path/method
    const cacheKey = `idempotency:${idempotencyKey}:${request.method}:${request.url}`;

    try {
      // Check if we have a cached response
      const cachedResponse = await this.redis.get(cacheKey);
      
      if (cachedResponse) {
        const parsed: CachedResponse = JSON.parse(cachedResponse);
        
        this.logger.log(`Returning cached response for key: ${idempotencyKey}`);
        
        // Set any cached headers
        if (parsed.headers) {
          Object.entries(parsed.headers).forEach(([key, value]) => {
            response.header(key, value);
          });
        }
        
        // Return the cached response with the original status code
        response.status(parsed.statusCode);
        return new Observable(subscriber => {
          subscriber.next(parsed.data);
          subscriber.complete();
        });
      }

      // No cached response, proceed with the request
      this.logger.log(`Processing new request for key: ${idempotencyKey}`);
      
      return next.handle().pipe(
        tap(async (data) => {
          try {
            // Cache the successful response
            const responseToCache: CachedResponse = {
              statusCode: response.statusCode || 200,
              data,
              headers: {
                'content-type': 'application/json',
              },
              timestamp: Date.now(),
            };

            await this.redis.setex(cacheKey, this.TTL, JSON.stringify(responseToCache));
            this.logger.log(`Cached response for key: ${idempotencyKey}`);
          } catch (error) {
            this.logger.error(`Failed to cache response for key ${idempotencyKey}:`, error);
            // Don't fail the request if caching fails
          }
        })
      );
    } catch (error) {
      this.logger.error(`Redis error for key ${idempotencyKey}:`, error);
      // If Redis is down, continue without idempotency protection
      this.logger.warn('Continuing without idempotency protection due to Redis error');
      return next.handle();
    }
  }
}
