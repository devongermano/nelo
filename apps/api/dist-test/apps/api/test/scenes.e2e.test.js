"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const main_1 = require("../src/main");
let app;
(0, vitest_1.describe)('scenes routes', () => {
    (0, vitest_1.beforeAll)(async () => {
        app = await (0, main_1.buildApp)();
    });
    (0, vitest_1.afterAll)(async () => {
        await app.close();
    });
    (0, vitest_1.it)('requires X-Idempotency-Key on POST', async () => {
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .send({ text: 'hello' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('detects duplicate X-Idempotency-Key', async () => {
        const res1 = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .set('X-Idempotency-Key', 'dup')
            .send({ text: 'a' });
        (0, vitest_1.expect)(res1.status).toBe(201);
        const res2 = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .set('X-Idempotency-Key', 'dup')
            .send({ text: 'b' });
        (0, vitest_1.expect)(res2.status).toBe(409);
    });
    (0, vitest_1.it)('requires If-Match on PATCH', async () => {
        const create = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .set('X-Idempotency-Key', 'patch1')
            .send({ text: 'initial' });
        const id = create.body.id;
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .patch(`/scenes/${id}`)
            .send({ text: 'change' });
        (0, vitest_1.expect)(res.status).toBe(400);
    });
    (0, vitest_1.it)('rejects mismatched If-Match', async () => {
        const create = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .set('X-Idempotency-Key', 'patch2')
            .send({ text: 'initial' });
        const id = create.body.id;
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .patch(`/scenes/${id}`)
            .set('If-Match', '999')
            .send({ text: 'change' });
        (0, vitest_1.expect)(res.status).toBe(412);
    });
    (0, vitest_1.it)('accepts correct If-Match', async () => {
        const create = await (0, supertest_1.default)(app.getHttpServer())
            .post('/scenes')
            .set('X-Idempotency-Key', 'patch3')
            .send({ text: 'initial' });
        const id = create.body.id;
        const version = create.body.version;
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .patch(`/scenes/${id}`)
            .set('If-Match', String(version))
            .send({ text: 'change' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.version).toBe(version + 1);
    });
});
//# sourceMappingURL=scenes.e2e.test.js.map