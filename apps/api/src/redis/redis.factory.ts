import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export interface RedisConnectionOptions {
  url?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

export function createRedisConnection(
  options: RedisConnectionOptions = {},
  logger?: Logger,
): Redis {
  const log = logger || new Logger('RedisFactory');

  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RedisMock = require('ioredis-mock');
    return new RedisMock();
  }

  const redisUrl = options.url || process.env.REDIS_URL || 'redis://localhost:6379';

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
    enableReadyCheck: options.enableReadyCheck !== false,
    lazyConnect: options.lazyConnect !== false,
    reconnectOnError: (err) => {
      log.warn(`Redis reconnect on error: ${err.message}`);
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      log.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
  });

  redis.on('connect', () => {
    log.log('Redis connection established');
  });

  redis.on('ready', () => {
    log.log('Redis connection ready');
  });

  redis.on('error', (err) => {
    log.error(`Redis connection error: ${err.message}`);
  });

  redis.on('close', () => {
    log.warn('Redis connection closed');
  });

  redis.on('reconnecting', (delay: number) => {
    log.log(`Redis reconnecting in ${delay}ms`);
  });

  redis.on('end', () => {
    log.warn('Redis connection ended');
  });

  return redis;
}