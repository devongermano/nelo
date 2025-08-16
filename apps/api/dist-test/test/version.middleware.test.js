"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const vitest_1 = require("vitest");
const version_middleware_1 = require("../src/middlewares/version.middleware");
(0, vitest_1.describe)('version middleware', () => {
    (0, vitest_1.it)('returns 412 when If-Match does not match scene.version', async () => {
        const app = (0, fastify_1.default)();
        const scene = { id: '1', text: 'hello', version: 1 };
        app.patch('/scenes/:id', {
            preHandler: [
                (req, _reply, done) => {
                    req.scene = scene;
                    done();
                },
                version_middleware_1.versionMiddleware
            ]
        }, async () => ({ ok: true }));
        const res = await app.inject({ method: 'PATCH', url: '/scenes/1', headers: { 'if-match': '2' } });
        (0, vitest_1.expect)(res.statusCode).toBe(412);
    });
});
//# sourceMappingURL=version.middleware.test.js.map