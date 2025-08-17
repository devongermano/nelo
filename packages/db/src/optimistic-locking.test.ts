import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, SceneStatus } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

describe('Optimistic Locking', () => {
  let projectId: string;
  let sceneId: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test data
    const project = await prisma.project.create({
      data: {
        name: 'Optimistic Lock Test',
        slug: `opt-lock-test-${Date.now()}`,
        version: 1
      }
    });
    projectId = project.id;

    const book = await prisma.book.create({
      data: {
        projectId,
        title: 'Test Book',
        index: 0,
        version: 1
      }
    });

    const chapter = await prisma.chapter.create({
      data: {
        bookId: book.id,
        title: 'Test Chapter',
        index: 0,
        version: 1
      }
    });

    const scene = await prisma.scene.create({
      data: {
        projectId,
        chapterId: chapter.id,
        title: 'Test Scene',
        index: 0,
        status: SceneStatus.DRAFT,
        contentMd: 'Initial content',
        version: 1
      }
    });
    sceneId = scene.id;
  });

  afterAll(async () => {
    // Clean up - CASCADE deletes will handle children
    if (projectId) {
      try {
        await prisma.project.deleteMany({ where: { id: projectId } });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await prisma.$disconnect();
  });

  it('should increment version on update', async () => {
    // Ensure test data was created
    expect(sceneId).toBeDefined();
    
    // Initial version should be 1
    const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
    expect(scene).toBeDefined();
    expect(scene?.version).toBe(1);

    // Update the scene
    const updated = await prisma.scene.update({
      where: { id: sceneId },
      data: {
        contentMd: 'Updated content',
        version: { increment: 1 }
      }
    });

    expect(updated.version).toBe(2);
    expect(updated.contentMd).toBe('Updated content');
  });

  it('should handle concurrent updates with version check', async () => {
    // Get current scene
    const scene1 = await prisma.scene.findUnique({ where: { id: sceneId } });
    const currentVersion = scene1!.version;

    // First update succeeds
    const update1 = await prisma.scene.update({
      where: { 
        id: sceneId,
        version: currentVersion // Optimistic lock check
      },
      data: {
        contentMd: 'First update',
        version: { increment: 1 }
      }
    });
    expect(update1.version).toBe(currentVersion + 1);

    // Second update with stale version should fail
    try {
      await prisma.scene.update({
        where: { 
          id: sceneId,
          version: currentVersion // This is now stale
        },
        data: {
          contentMd: 'Second update',
          version: { increment: 1 }
        }
      });
      expect.fail('Should have thrown an error for stale version');
    } catch (error: any) {
      // Prisma throws P2025 when record not found (including version mismatch)
      expect(error.code).toBe('P2025');
    }
  });

  it('should support version check on Project model', async () => {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const initialVersion = project!.version;

    // Update with version check
    const updated = await prisma.project.update({
      where: { 
        id: projectId,
        version: initialVersion
      },
      data: {
        name: 'Updated Name',
        version: { increment: 1 }
      }
    });

    expect(updated.version).toBe(initialVersion + 1);
    expect(updated.name).toBe('Updated Name');
  });

  it('should support version field on all versionable models', async () => {
    // Test Book model
    const book = await prisma.book.findFirst({ where: { projectId } });
    expect(book?.version).toBeDefined();
    expect(typeof book?.version).toBe('number');

    // Test Chapter model
    const chapter = await prisma.chapter.findFirst({ 
      where: { book: { projectId } } 
    });
    expect(chapter?.version).toBeDefined();
    expect(typeof chapter?.version).toBe('number');

    // Test Scene model
    const scene = await prisma.scene.findFirst({ where: { projectId } });
    expect(scene?.version).toBeDefined();
    expect(typeof scene?.version).toBe('number');
  });
});