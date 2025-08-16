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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const idempotency_interceptor_1 = require("../src/interceptors/idempotency.interceptor");
const ioredis_mock_1 = __importDefault(require("ioredis-mock"));
const vitest_1 = require("vitest");
let TestController = class TestController {
    handler() {
        return { ok: true };
    }
};
__decorate([
    (0, common_1.Post)('test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TestController.prototype, "handler", null);
TestController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseInterceptors)(idempotency_interceptor_1.IdempotencyInterceptor)
], TestController);
(0, vitest_1.describe)('IdempotencyInterceptor', () => {
    let app;
    (0, vitest_1.beforeAll)(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            controllers: [TestController],
            providers: [
                idempotency_interceptor_1.IdempotencyInterceptor,
                { provide: idempotency_interceptor_1.IDEMPOTENCY_REDIS, useValue: new ioredis_mock_1.default() },
            ],
        }).compile();
        app = moduleRef.createNestApplication(new platform_fastify_1.FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    (0, vitest_1.afterAll)(async () => {
        await app.close();
    });
    (0, vitest_1.it)('returns cached response for duplicate idempotency key', async () => {
        const firstRes = await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
        (0, vitest_1.expect)(firstRes.statusCode).toBe(201);
        (0, vitest_1.expect)(JSON.parse(firstRes.body)).toEqual({ ok: true });
        const secondRes = await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
        (0, vitest_1.expect)(secondRes.statusCode).toBe(201);
        (0, vitest_1.expect)(JSON.parse(secondRes.body)).toEqual({ ok: true });
    });
});
//# sourceMappingURL=idempotency.interceptor.test.js.map