"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const db_1 = require("@nelo/db");
const scenes_service_1 = require("../src/scenes/scenes.service");
(0, vitest_1.beforeEach)(async () => {
    await (0, db_1.reset)();
});
(0, vitest_1.describe)('scenes.service', () => {
    (0, vitest_1.it)('returns scene by id', async () => {
        const project = await db_1.prisma.project.create({ data: { name: 'p', version: 1 } });
        const book = await db_1.prisma.book.create({ data: { title: 'b', projectId: project.id } });
        const chapter = await db_1.prisma.chapter.create({ data: { title: 'c', bookId: book.id } });
        const scene = await db_1.prisma.scene.create({ data: { chapterId: chapter.id, content: 'hi' } });
        const service = new scenes_service_1.ScenesService();
        const found = await service.getSceneById(scene.id);
        (0, vitest_1.expect)(found?.id).toBe(scene.id);
    });
    (0, vitest_1.it)('throws when scene missing', async () => {
        const service = new scenes_service_1.ScenesService();
        await (0, vitest_1.expect)(service.getSceneById('nonexistent')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
});
//# sourceMappingURL=scenes.service.test.js.map