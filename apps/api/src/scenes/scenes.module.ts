import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../interceptors/idempotency.interceptor';
import Redis from 'ioredis';

@Module({
  controllers: [ScenesController],
  providers: [
    ScenesService,
    IdempotencyInterceptor,
    {
      provide: IDEMPOTENCY_REDIS,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const RedisMock = require('ioredis-mock');
          return new RedisMock();
        }
        return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
      },
    },
  ],
})
export class ScenesModule {}
