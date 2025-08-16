"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisConnection = createRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const common_1 = require("@nestjs/common");
function createRedisConnection(options = {}, logger) {
    const log = logger || new common_1.Logger('RedisFactory');
    if (process.env.NODE_ENV === 'test') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RedisMock = require('ioredis-mock');
        return new RedisMock();
    }
    const redisUrl = options.url || process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
        enableReadyCheck: options.enableReadyCheck !== false,
        lazyConnect: options.lazyConnect !== false,
        reconnectOnError: (err) => {
            log.warn(`Redis reconnect on error: ${err.message}`);
            const targetError = 'READONLY';
            return err.message.includes(targetError);
        },
        retryStrategy: (times) => {
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
    redis.on('reconnecting', (delay) => {
        log.log(`Redis reconnecting in ${delay}ms`);
    });
    redis.on('end', () => {
        log.warn('Redis connection ended');
    });
    return redis;
}
//# sourceMappingURL=redis.factory.js.map