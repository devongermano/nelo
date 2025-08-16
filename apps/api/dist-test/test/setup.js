"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/nelo_test';
process.env.ENCRYPTION_KEY = '1234567890123456789012345678901a'; // Exactly 32 characters
process.env.REDIS_URL = 'redis://localhost:6379';
// Mock the @nelo/db package
vitest_1.vi.mock('@nelo/db', () => {
    const mockPrisma = {
        $connect: vitest_1.vi.fn().mockResolvedValue(undefined),
        $disconnect: vitest_1.vi.fn().mockResolvedValue(undefined),
        $transaction: vitest_1.vi.fn().mockImplementation((operations) => Promise.all(operations.map((op) => op))),
        project: {
            create: vitest_1.vi.fn().mockImplementation(({ data }) => Promise.resolve({
                id: 'test-id',
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            findMany: vitest_1.vi.fn().mockResolvedValue([
                {
                    id: 'test-id',
                    name: 'proj',
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]),
            findUnique: vitest_1.vi.fn().mockResolvedValue({
                id: 'test-id',
                name: 'proj',
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }),
        },
        scene: {
            create: vitest_1.vi.fn().mockImplementation(({ data }) => Promise.resolve({
                id: 'scene-id',
                projectId: data.chapterId ? 'project-id' : data.projectId,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            findUnique: vitest_1.vi.fn().mockImplementation(({ where }) => {
                if (where.id === 'nonexistent') {
                    return Promise.resolve(null);
                }
                return Promise.resolve({
                    id: 'scene-id',
                    content: 'test content',
                    chapterId: 'chapter-id',
                    projectId: 'project-id',
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }),
            deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }),
        },
        // Mock all the other models for the reset function
        book: {
            create: vitest_1.vi.fn().mockImplementation(({ data }) => Promise.resolve({
                id: 'book-id',
                ...data,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }),
        },
        chapter: {
            create: vitest_1.vi.fn().mockImplementation(({ data }) => Promise.resolve({
                id: 'chapter-id',
                ...data,
                version: 1,
                order: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }),
        },
        embedding: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        sceneEntity: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        sentence: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        snapshot: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        editSpan: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        hunk: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        patch: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        refactor: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        costEvent: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        run: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        contextRule: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        canonFact: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        entity: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        providerKey: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        budget: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        styleGuide: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        membership: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
        user: { deleteMany: vitest_1.vi.fn().mockResolvedValue({ count: 0 }) },
    };
    return {
        prisma: mockPrisma,
        reset: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
});
// Mock the GatewayModule to prevent WebSocket issues in tests
vitest_1.vi.mock('../src/gateway/gateway.module', () => ({
    GatewayModule: class MockGatewayModule {
    },
}));
// Global test setup
beforeAll(async () => {
    // Setup code that runs before all tests
});
afterAll(async () => {
    // Cleanup code that runs after all tests
});
//# sourceMappingURL=setup.js.map