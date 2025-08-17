import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, SceneStatus } from '@prisma/client';

// Create a real Prisma client for these tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

describe('Database Schema', () => {
  beforeAll(async () => {
    // Clean up database before tests
    await prisma.$transaction([
      prisma.sceneEntity.deleteMany(),
      prisma.embedding.deleteMany(),
      prisma.editSpan.deleteMany(),
      prisma.hunk.deleteMany(),
      prisma.patch.deleteMany(),
      prisma.refactor.deleteMany(),
      prisma.costEvent.deleteMany(),
      prisma.run.deleteMany(),
      prisma.suggestion.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.collabSession.deleteMany(),
      prisma.sentence.deleteMany(),
      prisma.snapshot.deleteMany(),
      prisma.scene.deleteMany(),
      prisma.chapter.deleteMany(),
      prisma.book.deleteMany(),
      prisma.canonFact.deleteMany(),
      prisma.entity.deleteMany(),
      prisma.contextRule.deleteMany(),
      prisma.modelProfile.deleteMany(),
      prisma.persona.deleteMany(),
      prisma.promptPreset.deleteMany(),
      prisma.styleGuide.deleteMany(),
      prisma.budget.deleteMany(),
      prisma.providerKey.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
      prisma.membership.deleteMany(),
      prisma.team.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User and Team Models', () => {
    it('should create a user with all fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          displayName: 'Test User',
          settings: { theme: 'dark' },
        },
      });

      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.settings).toEqual({ theme: 'dark' });
    });

    it('should create a team with members', async () => {
      const user = await prisma.user.create({
        data: { email: 'team@example.com' },
      });

      const team = await prisma.team.create({
        data: {
          name: 'Test Team',
          members: {
            create: {
              userId: user.id,
              role: 'WRITER',
            },
          },
        },
        include: { members: true },
      });

      expect(team.name).toBe('Test Team');
      expect(team.members).toHaveLength(1);
      expect(team.members[0].role).toBe('WRITER');
    });
  });

  describe('Project Structure', () => {
    it('should create a complete project hierarchy', async () => {
      const user = await prisma.user.create({
        data: { email: 'author@example.com' },
      });

      const project = await prisma.project.create({
        data: {
          name: 'My Novel',
          slug: 'my-novel',
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
          books: {
            create: {
              title: 'Book One',
              index: 0,
              chapters: {
                create: {
                  title: 'Chapter 1',
                  index: 0
                },
              },
            },
          },
        },
        include: {
          books: {
            include: {
              chapters: true,
            },
          },
        },
      });

      // Create scene separately with proper projectId
      const chapter = project.books[0].chapters[0];
      await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          title: 'Opening Scene',
          index: 0,
          status: SceneStatus.DRAFT,
          contentMd: '# Opening\n\nIt was a dark and stormy night...',
          docCrdt: {},
          wordCount: 7,
        },
      });

      // Refetch project with scenes
      const fullProject = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          books: {
            include: {
              chapters: {
                include: {
                  scenes: true,
                },
              },
            },
          },
        },
      });

      expect(fullProject!.slug).toBe('my-novel');
      expect(fullProject!.books).toHaveLength(1);
      expect(fullProject!.books[0].chapters).toHaveLength(1);
      expect(fullProject!.books[0].chapters[0].scenes).toHaveLength(1);
      expect(fullProject!.books[0].chapters[0].scenes[0].contentMd).toContain('dark and stormy');
    });
  });

  describe('Scene Model', () => {
    it('should have all required fields', async () => {
      const project = await prisma.project.create({
        data: { name: 'Scene Test', slug: 'scene-test' },
      });

      const book = await prisma.book.create({
        data: {
          projectId: project.id,
          title: 'Test Book',
          index: 0,
        },
      });

      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          title: 'Test Chapter',
          index: 0,
        },
      });

      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          title: 'Test Scene',
          index: 0,
          status: SceneStatus.DRAFT,
          pov: 'first-person',
          tense: 'past',
          contentMd: 'Test content',
          docCrdt: { ops: [] },
          summary: 'A test scene',
          wordCount: 2,
        },
      });

      expect(scene.title).toBe('Test Scene');
      expect(scene.status).toBe(SceneStatus.DRAFT);
      expect(scene.pov).toBe('first-person');
      expect(scene.tense).toBe('past');
      expect(scene.contentMd).toBe('Test content');
      expect(scene.docCrdt).toEqual({ ops: [] });
      expect(scene.summary).toBe('A test scene');
      expect(scene.wordCount).toBe(2);
    });
  });

  describe('Entity and CanonFact Models', () => {
    it('should create entities with arrays', async () => {
      const project = await prisma.project.create({
        data: { name: 'Entity Test', slug: 'entity-test' },
      });

      const entity = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'John Doe',
          aliases: ['Johnny', 'JD'],
          traits: ['brave', 'clever', 'stubborn'],
        },
      });

      expect(entity.type).toBe('CHARACTER');
      expect(entity.aliases).toEqual(['Johnny', 'JD']);
      expect(entity.traits).toEqual(['brave', 'clever', 'stubborn']);
    });

    it('should create canon facts with reveal state', async () => {
      const project = await prisma.project.create({
        data: { name: 'Canon Test', slug: 'canon-test' },
      });

      const entity = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'Jane Doe',
          aliases: [],
          traits: [],
        },
      });

      const fact = await prisma.canonFact.create({
        data: {
          entityId: entity.id,
          fact: 'Jane is secretly a vampire',
          revealState: 'REDACTED_UNTIL_SCENE',
          revealSceneId: 'scene-123',
          confidence: 95,
        },
      });

      expect(fact.fact).toBe('Jane is secretly a vampire');
      expect(fact.revealState).toBe('REDACTED_UNTIL_SCENE');
      expect(fact.confidence).toBe(95);
    });
  });

  describe('AI Models', () => {
    it('should create prompt presets and personas', async () => {
      const project = await prisma.project.create({
        data: { name: 'AI Test', slug: 'ai-test' },
      });

      const prompt = await prisma.promptPreset.create({
        data: {
          name: 'Epic Fantasy',
          text: 'Write in the style of epic fantasy...',
          projectId: project.id,
        },
      });

      const persona = await prisma.persona.create({
        data: {
          name: 'Tolkien',
          style: 'High fantasy with rich world-building',
          projectId: project.id,
        },
      });

      const model = await prisma.modelProfile.create({
        data: {
          name: 'GPT-4 Turbo',
          provider: 'openai',
          config: { temperature: 0.7, maxTokens: 4000 },
          projectId: project.id,
        },
      });

      expect(prompt.name).toBe('Epic Fantasy');
      expect(persona.style).toContain('High fantasy');
      expect(model.provider).toBe('openai');
    });
  });

  describe('Collaboration Models', () => {
    it('should create comments and suggestions', async () => {
      const project = await prisma.project.create({
        data: { name: 'Collab Test', slug: 'collab-test' },
      });

      const book = await prisma.book.create({
        data: { projectId: project.id, title: 'Book', index: 0 },
      });

      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, title: 'Chapter', index: 0 },
      });

      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          index: 0,
          status: SceneStatus.DRAFT,
          contentMd: 'Content',
          docCrdt: {},
          wordCount: 1,
        },
      });

      const comment = await prisma.comment.create({
        data: {
          sceneId: scene.id,
          author: 'reviewer@example.com',
          text: 'Great opening!',
          range: { start: 0, end: 10 },
        },
      });

      const suggestion = await prisma.suggestion.create({
        data: {
          sceneId: scene.id,
          author: 'editor@example.com',
          text: 'Consider adding more detail',
          status: 'OPEN',
        },
      });

      expect(comment.text).toBe('Great opening!');
      expect(suggestion.status).toBe('OPEN');
    });

    it('should create collaboration sessions', async () => {
      const project = await prisma.project.create({
        data: { name: 'Session Test', slug: 'session-test' },
      });

      const book = await prisma.book.create({
        data: { projectId: project.id, title: 'Book', index: 0 },
      });

      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, title: 'Chapter', index: 0 },
      });

      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          index: 0,
          status: SceneStatus.DRAFT,
          contentMd: '',
          docCrdt: {},
          wordCount: 0,
        },
      });

      const session = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: ['user1', 'user2', 'user3'],
          active: true,
        },
      });

      expect(session.users).toEqual(['user1', 'user2', 'user3']);
      expect(session.active).toBe(true);
    });
  });

  describe('Refactoring Models', () => {
    it('should create refactor with patches and hunks', async () => {
      const project = await prisma.project.create({
        data: { name: 'Refactor Test', slug: 'refactor-test' },
      });

      const book = await prisma.book.create({
        data: { projectId: project.id, title: 'Book', index: 0 },
      });

      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, title: 'Chapter', index: 0 },
      });

      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          index: 0,
          status: SceneStatus.DRAFT,
          contentMd: 'Original content',
          docCrdt: {},
          wordCount: 2,
        },
      });

      const refactor = await prisma.refactor.create({
        data: {
          projectId: project.id,
          scopeType: 'SCENE',
          scopeId: scene.id,
          instruction: 'Make dialogue more natural',
          status: 'DRAFT',
          createdBy: 'user123',
          patches: {
            create: {
              sceneId: scene.id,
              status: 'PROPOSED',
              summary: 'Update dialogue in opening',
              unifiedDiff: '--- a\n+++ b\n...',
              confidence: 85,
              hunks: {
                create: {
                  status: 'PROPOSED',
                  summary: 'Fix greeting',
                  unifiedDiff: '--- a\n+++ b\n...',
                  confidence: 90,
                },
              },
            },
          },
        },
        include: {
          patches: {
            include: {
              hunks: true,
            },
          },
        },
      });

      expect(refactor.scopeType).toBe('SCENE');
      expect(refactor.patches).toHaveLength(1);
      expect(refactor.patches[0].hunks).toHaveLength(1);
    });
  });

  describe('Enum Values', () => {
    it('should accept all Role enum values', async () => {
      const roles = ['OWNER', 'MAINTAINER', 'WRITER', 'READER'];
      const user = await prisma.user.create({
        data: { email: 'roles@example.com' },
      });
      const team = await prisma.team.create({
        data: { name: 'Role Test Team' },
      });

      for (const role of roles) {
        const membership = await prisma.membership.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: role as any,
          },
        });
        expect(membership.role).toBe(role);
      }
    });

    it('should accept all RevealState enum values', async () => {
      const states = ['PLANNED', 'REVEALED', 'REDACTED_UNTIL_SCENE', 'REDACTED_UNTIL_DATE'];
      const project = await prisma.project.create({
        data: { name: 'Reveal Test', slug: 'reveal-test' },
      });
      const entity = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'Test',
          aliases: [],
          traits: [],
        },
      });

      for (const state of states) {
        const fact = await prisma.canonFact.create({
          data: {
            entityId: entity.id,
            fact: `Fact with ${state}`,
            revealState: state as any,
          },
        });
        expect(fact.revealState).toBe(state);
      }
    });
  });
});