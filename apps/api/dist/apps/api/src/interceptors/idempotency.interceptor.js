"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var IdempotencyInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyInterceptor = exports.IDEMPOTENCY_REDIS = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const ioredis_1 = __importDefault(require("ioredis"));
exports.IDEMPOTENCY_REDIS = 'IDEMPOTENCY_REDIS';
let IdempotencyInterceptor = IdempotencyInterceptor_1 = class IdempotencyInterceptor {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(IdempotencyInterceptor_1.name);
        this.TTL = 60 * 60; // 1 hour
    }
    async intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const idempotencyKey = request.headers['x-idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            throw new common_1.BadRequestException('X-Idempotency-Key header required');
        }
        // Create a unique key based on the idempotency key and request path/method
        const cacheKey = `idempotency:${idempotencyKey}:${request.method}:${request.url}`;
        try {
            // Check if we have a cached response
            const cachedResponse = await this.redis.get(cacheKey);
            if (cachedResponse) {
                const parsed = JSON.parse(cachedResponse);
                this.logger.log(`Returning cached response for key: ${idempotencyKey}`);
                // Set any cached headers
                if (parsed.headers) {
                    Object.entries(parsed.headers).forEach(([key, value]) => {
                        response.header(key, value);
                    });
                }
                // Return the cached response with the original status code
                response.status(parsed.statusCode);
                return new rxjs_1.Observable(subscriber => {
                    subscriber.next(parsed.data);
                    subscriber.complete();
                });
            }
            // No cached response, proceed with the request
            this.logger.log(`Processing new request for key: ${idempotencyKey}`);
            return next.handle().pipe((0, operators_1.tap)(async (data) => {
                try {
                    // Cache the successful response
                    const responseToCache = {
                        statusCode: response.statusCode || 200,
                        data,
                        headers: {
                            'content-type': 'application/json',
                        },
                        timestamp: Date.now(),
                    };
                    await this.redis.setex(cacheKey, this.TTL, JSON.stringify(responseToCache));
                    this.logger.log(`Cached response for key: ${idempotencyKey}`);
                }
                catch (error) {
                    this.logger.error(`Failed to cache response for key ${idempotencyKey}:`, error);
                    // Don't fail the request if caching fails
                }
            }));
        }
        catch (error) {
            this.logger.error(`Redis error for key ${idempotencyKey}:`, error);
            // If Redis is down, continue without idempotency protection
            this.logger.warn('Continuing without idempotency protection due to Redis error');
            return next.handle();
        }
    }
};
exports.IdempotencyInterceptor = IdempotencyInterceptor;
exports.IdempotencyInterceptor = IdempotencyInterceptor = IdempotencyInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.IDEMPOTENCY_REDIS)),
    __metadata("design:paramtypes", [ioredis_1.default])
], IdempotencyInterceptor);
