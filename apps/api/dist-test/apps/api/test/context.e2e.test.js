"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="vitest" />
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const main_1 = require("../src/main");
(0, vitest_1.describe)('POST /compose-context', () => {
    (0, vitest_1.it)('returns empty segments and redactions', async () => {
        const app = await (0, main_1.buildApp)();
        const response = await (0, supertest_1.default)(app.getHttpServer())
            .post('/compose-context')
            .send({ template: 'hi' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual({ segments: [], redactions: [] });
        await app.close();
    }, 10000);
});
//# sourceMappingURL=context.e2e.test.js.map