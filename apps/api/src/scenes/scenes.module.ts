import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../interceptors/idempotency.interceptor';
import { createRedisConnection } from '../redis';

@Module({
  controllers: [ScenesController],
  providers: [
    ScenesService,
    IdempotencyInterceptor,
    {
      provide: IDEMPOTENCY_REDIS,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('ScenesModule:Redis');
        return createRedisConnection(
          {
            url: configService.get('REDIS_URL'),
          },
          logger,
        );
      },
      inject: [ConfigService],
    },
  ],
})
export class ScenesModule {}
