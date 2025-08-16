import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import Redis from 'ioredis';

export const IDEMPOTENCY_REDIS = 'IDEMPOTENCY_REDIS';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEMPOTENCY_REDIS) private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = request.headers['x-idempotency-key'];
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('X-Idempotency-Key header required');
    }
    const set = await this.redis.setnx(key, '1');
    if (set === 0) {
      throw new ConflictException('Duplicate request');
    }
    await this.redis.expire(key, 60 * 60);
    return next.handle();
  }
}
