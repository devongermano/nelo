// Test environment setup
import { vi } from 'vitest';

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/nelo_test';
process.env.ENCRYPTION_KEY = '1234567890123456789012345678901a'; // Exactly 32 characters

// Mock Prisma client for tests that don't need real database
vi.mock('./src/client', () => {
  const mockPrisma = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((operations) => 
      Promise.all(operations.map((op: any) => op))
    ),
    project: {
      create: vi.fn().mockResolvedValue({ 
        id: 'test-id', 
        name: 'test', 
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 'demo-project-id') {
          return Promise.resolve({ 
            id: 'demo-project-id', 
            name: 'Demo Project', 
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        return Promise.resolve({ 
          id: 'test-id', 
          name: 'test', 
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    scene: {
      create: vi.fn().mockResolvedValue({
        id: 'scene-id',
        content: 'test content',
        chapterId: 'chapter-id',
        projectId: 'project-id',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 'secret-scene-id') {
          return Promise.resolve({
            id: 'secret-scene-id',
            content: 'This is a secret scene',
            chapterId: 'chapter-id',
            projectId: 'project-id',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          });
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
    chapter: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    book: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    providerKey: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    budget: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    styleGuide: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    membership: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };

  return {
    prisma: mockPrisma,
  };
});

// Mock the seed data
vi.mock('./seed-data.js', () => ({
  demoProject: {
    name: 'Demo Project',
    version: 1,
  },
  secretScene: {
    content: 'This is a secret scene',
  },
}));

// Mock the seed function
vi.mock('./seed.js', () => ({
  seed: vi.fn().mockResolvedValue({
    projectId: 'demo-project-id',
    sceneId: 'secret-scene-id',
  }),
}));