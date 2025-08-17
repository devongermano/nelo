import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, SceneStatus } from '@prisma/client'

// Define the demo data directly in the test to avoid mock conflicts
const demoProject = {
  name: 'Demo Project',
  slug: 'demo-project',
  books: {
    create: [
      {
        title: 'Demo Book',
        index: 0,
        chapters: {
          create: [
            {
              title: 'Demo Chapter',
              index: 0,
            },
          ],
        },
      },
    ],
  },
};

const secretScene = {
  index: 0,
  contentMd: 'The cake is a lie.',
  status: SceneStatus.DRAFT,
};

// Use real Prisma client for seed tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

describe('seed script', () => {
  beforeAll(async () => {
    await prisma.$connect();
    // Clean up before seeding
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Project" CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seed() {
    const project = await prisma.project.create({
      data: demoProject,
      include: {
        books: {
          include: {
            chapters: true,
          },
        },
      },
    });

    // Create the secret scene with proper projectId
    const chapter = project.books[0].chapters[0];
    const scene = await prisma.scene.create({
      data: {
        ...secretScene,
        chapterId: chapter.id,
        projectId: project.id,
      }
    });

    return { projectId: project.id, sceneId: scene.id };
  }

  it('inserts demo project and secret scene', async () => {
    const { projectId, sceneId } = await seed();
    
    const project = await prisma.project.findUnique({ 
      where: { id: projectId } 
    });
    const scene = await prisma.scene.findUnique({ 
      where: { id: sceneId } 
    });
    
    expect(project?.name).toBe(demoProject.name);
    expect(scene?.contentMd).toBe(secretScene.contentMd);
  })
})
