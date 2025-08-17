import { vi, beforeAll, afterAll } from 'vitest';

// Mock environment variables for testing
// @ts-ignore
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/nelo_test';
process.env.ENCRYPTION_KEY = '1234567890123456789012345678901a'; // Exactly 32 characters
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock the @nelo/db package
vi.mock('@nelo/db', () => {
  const mockPrisma = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((operations) => 
      Promise.all(operations.map((op: any) => op))
    ),
    project: {
      create: vi.fn().mockImplementation(({ data }) => 
        Promise.resolve({ 
          id: 'test-id', 
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ),
      findMany: vi.fn().mockResolvedValue([
        { 
          id: 'test-id', 
          name: 'proj', 
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      findUnique: vi.fn().mockResolvedValue({ 
        id: 'test-id', 
        name: 'proj', 
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    scene: {
      create: vi.fn().mockImplementation(({ data }) => 
        Promise.resolve({
          id: 'scene-id',
          projectId: data.chapterId ? 'project-id' : data.projectId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ),
      findUnique: vi.fn().mockImplementation(({ where }) => {
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
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // Mock all the other models for the reset function
    book: {
      create: vi.fn().mockImplementation(({ data }) => 
        Promise.resolve({
          id: 'book-id',
          ...data,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    chapter: {
      create: vi.fn().mockImplementation(({ data }) => 
        Promise.resolve({
          id: 'chapter-id',
          ...data,
          version: 1,
          order: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    embedding: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sceneEntity: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sentence: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    snapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    editSpan: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    hunk: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    patch: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    refactor: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    costEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    run: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    contextRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    canonFact: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    entity: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    providerKey: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    budget: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    styleGuide: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    membership: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };

  return {
    prisma: mockPrisma,
    reset: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock the GatewayModule to prevent WebSocket issues in tests
vi.mock('../src/gateway/gateway.module', () => ({
  GatewayModule: class MockGatewayModule {},
}));

// Global test setup
beforeAll(async () => {
  // Setup code that runs before all tests
});

afterAll(async () => {
  // Cleanup code that runs after all tests
});