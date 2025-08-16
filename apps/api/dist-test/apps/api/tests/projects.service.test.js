"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("@nelo/db");
const projects_service_1 = require("../src/projects/projects.service");
(0, vitest_1.beforeEach)(async () => {
    await (0, db_1.reset)();
});
(0, vitest_1.describe)('projects.service', () => {
    (0, vitest_1.it)('returns all projects', async () => {
        await db_1.prisma.project.create({ data: { name: 'proj', version: 1 } });
        const service = new projects_service_1.ProjectsService();
        const projects = await service.getAllProjects();
        (0, vitest_1.expect)(projects.length).toBe(1);
        (0, vitest_1.expect)(projects[0].name).toBe('proj');
    });
});
//# sourceMappingURL=projects.service.test.js.map