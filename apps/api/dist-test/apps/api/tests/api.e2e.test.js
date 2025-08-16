"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const db_1 = require("@nelo/db");
const main_1 = require("../src/main");
(0, vitest_1.beforeEach)(async () => {
    await (0, db_1.reset)();
});
(0, vitest_1.describe)('API e2e', () => {
    (0, vitest_1.it)('GET /projects', async () => {
        await db_1.prisma.project.create({ data: { name: 'proj', version: 1 } });
        const app = await (0, main_1.buildApp)();
        const res = await (0, supertest_1.default)(app.getHttpServer()).get('/projects');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.length).toBe(1);
        await app.close();
    }, 10000);
    (0, vitest_1.it)('GET /scenes/:id', async () => {
        const project = await db_1.prisma.project.create({ data: { name: 'p', version: 1 } });
        const book = await db_1.prisma.book.create({ data: { title: 'b', projectId: project.id } });
        const chapter = await db_1.prisma.chapter.create({ data: { title: 'c', bookId: book.id } });
        const scene = await db_1.prisma.scene.create({ data: { chapterId: chapter.id, projectId: project.id, content: 'hi' } });
        const app = await (0, main_1.buildApp)();
        const res = await (0, supertest_1.default)(app.getHttpServer()).get(`/scenes/${scene.id}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.id).toBe(scene.id);
        const missing = await (0, supertest_1.default)(app.getHttpServer()).get('/scenes/nonexistent');
        (0, vitest_1.expect)(missing.status).toBe(404);
        await app.close();
    }, 10000);
});
//# sourceMappingURL=api.e2e.test.js.map