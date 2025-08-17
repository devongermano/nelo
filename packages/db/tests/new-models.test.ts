import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Create a real Prisma client for these tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

// Helper to generate unique test identifiers
const uniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Helper to create a test project
async function createTestProject() {
  const testId = uniqueId();
  return await prisma.project.create({
    data: {
      name: `Test Project ${testId}`,
      slug: `test-project-${testId}`
    }
  });
}

// Helper to create a complete hierarchy
async function createHierarchy() {
  const testId = uniqueId();
  const project = await prisma.project.create({
    data: {
      name: `Hierarchy Test ${testId}`,
      slug: `hierarchy-${testId}`,
      books: {
        create: {
          title: 'Test Book',
          index: 0,
          chapters: {
            create: {
              title: 'Test Chapter',
              index: 0
            }
          }
        }
      }
    },
    include: {
      books: {
        include: {
          chapters: true
        }
      }
    }
  });

  const chapter = project.books[0].chapters[0];
  const scene = await prisma.scene.create({
    data: {
      chapterId: chapter.id,
      projectId: project.id,
      title: 'Test Scene',
      index: 0,
      contentMd: 'Test content'
    }
  });

  return { 
    project, 
    book: project.books[0], 
    chapter, 
    scene 
  };
}

describe('New Model Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$transaction([
      prisma.suggestion.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.collabSession.deleteMany(),
      prisma.scene.deleteMany(),
      prisma.chapter.deleteMany(),
      prisma.book.deleteMany(),
      prisma.modelProfile.deleteMany(),
      prisma.persona.deleteMany(),
      prisma.promptPreset.deleteMany(),
      prisma.project.deleteMany(),
    ]);
    await prisma.$disconnect();
  });

  describe('PromptPreset', () => {
    it('should create and retrieve prompt preset without project', async () => {
      const testId = uniqueId();
      const preset = await prisma.promptPreset.create({
        data: { 
          name: `Test Preset ${testId}`, 
          text: 'Template text for prompts' 
        }
      });
      
      expect(preset.name).toBe(`Test Preset ${testId}`);
      expect(preset.text).toBe('Template text for prompts');
      expect(preset.projectId).toBeNull();
    });

    it('should create prompt preset with project relation', async () => {
      const project = await createTestProject();
      const testId = uniqueId();
      
      const preset = await prisma.promptPreset.create({
        data: { 
          name: `Project Preset ${testId}`, 
          text: 'Project-specific template',
          projectId: project.id 
        }
      });
      
      expect(preset.projectId).toBe(project.id);
      
      // Verify relation works
      const projectWithPresets = await prisma.project.findUnique({
        where: { id: project.id },
        include: { prompts: true }
      });
      
      expect(projectWithPresets?.prompts).toHaveLength(1);
      expect(projectWithPresets?.prompts[0].name).toBe(`Project Preset ${testId}`);
    });
  });

  describe('Persona', () => {
    it('should create persona with style information', async () => {
      const testId = uniqueId();
      const persona = await prisma.persona.create({
        data: { 
          name: `Editor ${testId}`, 
          style: 'Professional, concise, focus on clarity'
        }
      });
      
      expect(persona.name).toBe(`Editor ${testId}`);
      expect(persona.style).toContain('Professional');
    });

    it('should create persona with project relation', async () => {
      const project = await createTestProject();
      const testId = uniqueId();
      
      const persona = await prisma.persona.create({
        data: { 
          name: `Project Editor ${testId}`, 
          style: 'Matches project tone',
          projectId: project.id 
        }
      });
      
      expect(persona.projectId).toBe(project.id);
      
      // Verify multiple personas per project
      const persona2 = await prisma.persona.create({
        data: { 
          name: `Beta Reader ${testId}`, 
          style: 'Critical but constructive',
          projectId: project.id 
        }
      });
      
      const projectWithPersonas = await prisma.project.findUnique({
        where: { id: project.id },
        include: { personas: true }
      });
      
      expect(projectWithPersonas?.personas).toHaveLength(2);
    });
  });

  describe('ModelProfile', () => {
    it('should store AI model configuration as JSON', async () => {
      const testId = uniqueId();
      const config = { 
        temperature: 0.7, 
        maxTokens: 4000,
        topP: 0.9,
        frequencyPenalty: 0.5 
      };
      
      const model = await prisma.modelProfile.create({
        data: { 
          name: `GPT-4 Profile ${testId}`,
          provider: 'openai',
          config 
        }
      });
      
      expect(model.provider).toBe('openai');
      expect(model.config).toEqual(config);
      expect((model.config as any).temperature).toBe(0.7);
    });

    it('should support different providers with different configs', async () => {
      const testId = uniqueId();
      
      const openaiModel = await prisma.modelProfile.create({
        data: { 
          name: `OpenAI ${testId}`,
          provider: 'openai',
          config: { model: 'gpt-4', temperature: 0.8 }
        }
      });
      
      const anthropicModel = await prisma.modelProfile.create({
        data: { 
          name: `Claude ${testId}`,
          provider: 'anthropic',
          config: { model: 'claude-3-opus', maxTokens: 100000 }
        }
      });
      
      expect(openaiModel.provider).toBe('openai');
      expect(anthropicModel.provider).toBe('anthropic');
      expect((openaiModel.config as any).model).toBe('gpt-4');
      expect((anthropicModel.config as any).model).toBe('claude-3-opus');
    });
  });

  describe('Comment', () => {
    it('should create comments on scenes', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      const comment = await prisma.comment.create({
        data: {
          sceneId: scene.id,
          author: `user-${testId}`,
          text: 'This scene needs more tension',
          range: { start: 0, end: 50 }
        }
      });
      
      expect(comment.sceneId).toBe(scene.id);
      expect(comment.text).toContain('tension');
      expect(comment.range).toEqual({ start: 0, end: 50 });
    });

    it('should support multiple comments per scene', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      await prisma.comment.createMany({
        data: [
          {
            sceneId: scene.id,
            author: `user1-${testId}`,
            text: 'Great opening'
          },
          {
            sceneId: scene.id,
            author: `user2-${testId}`,
            text: 'Consider adding dialogue'
          },
          {
            sceneId: scene.id,
            author: `user3-${testId}`,
            text: 'Perfect ending'
          }
        ]
      });
      
      const sceneWithComments = await prisma.scene.findUnique({
        where: { id: scene.id },
        include: { comments: true }
      });
      
      expect(sceneWithComments?.comments).toHaveLength(3);
      expect(sceneWithComments?.comments.map(c => c.text)).toContain('Great opening');
    });
  });

  describe('Suggestion', () => {
    it('should create suggestions with status tracking', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      const suggestion = await prisma.suggestion.create({
        data: {
          sceneId: scene.id,
          author: `editor-${testId}`,
          text: 'Replace "walked" with "strode" for more impact',
          status: 'OPEN',
          range: { start: 100, end: 106 }
        }
      });
      
      expect(suggestion.status).toBe('OPEN');
      
      // Update status
      const updated = await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPLIED' }
      });
      
      expect(updated.status).toBe('APPLIED');
    });

    it('should track different suggestion statuses', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      await prisma.suggestion.createMany({
        data: [
          {
            sceneId: scene.id,
            author: `editor1-${testId}`,
            text: 'Suggestion 1',
            status: 'OPEN'
          },
          {
            sceneId: scene.id,
            author: `editor2-${testId}`,
            text: 'Suggestion 2',
            status: 'APPLIED'
          },
          {
            sceneId: scene.id,
            author: `editor3-${testId}`,
            text: 'Suggestion 3',
            status: 'DISMISSED'
          }
        ]
      });
      
      const openSuggestions = await prisma.suggestion.findMany({
        where: { 
          sceneId: scene.id,
          status: 'OPEN'
        }
      });
      
      expect(openSuggestions).toHaveLength(1);
    });
  });

  describe('CollabSession', () => {
    it('should create collaboration session for scene', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      const session = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: [`user1-${testId}`, `user2-${testId}`, `user3-${testId}`],
          active: true
        }
      });
      
      expect(session.users).toHaveLength(3);
      expect(session.active).toBe(true);
      expect(session.users).toContain(`user1-${testId}`);
    });

    it('should track active and inactive sessions', async () => {
      const { scene } = await createHierarchy();
      const testId = uniqueId();
      
      // Create active session
      const activeSession = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: [`user1-${testId}`],
          active: true
        }
      });
      
      // Create inactive session
      const inactiveSession = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: [`user2-${testId}`],
          active: false
        }
      });
      
      // Find only active sessions
      const activeSessions = await prisma.collabSession.findMany({
        where: {
          sceneId: scene.id,
          active: true
        }
      });
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(activeSession.id);
    });
  });

  describe('CASCADE DELETE', () => {
    it('should cascade delete all children when deleting project', async () => {
      const { project, book, chapter, scene } = await createHierarchy();
      
      // Add some related data
      await prisma.comment.create({
        data: {
          sceneId: scene.id,
          author: 'test-user',
          text: 'Test comment'
        }
      });
      
      await prisma.promptPreset.create({
        data: {
          name: 'Test Preset',
          text: 'Template',
          projectId: project.id
        }
      });
      
      // Delete project - should cascade
      await prisma.project.delete({ where: { id: project.id } });
      
      // Verify all children deleted
      const deletedBook = await prisma.book.findUnique({ 
        where: { id: book.id } 
      });
      const deletedChapter = await prisma.chapter.findUnique({ 
        where: { id: chapter.id } 
      });
      const deletedScene = await prisma.scene.findUnique({ 
        where: { id: scene.id } 
      });
      const deletedComments = await prisma.comment.findMany({
        where: { sceneId: scene.id }
      });
      
      expect(deletedBook).toBeNull();
      expect(deletedChapter).toBeNull();
      expect(deletedScene).toBeNull();
      expect(deletedComments).toHaveLength(0);
    });

    it('should cascade delete scene children', async () => {
      const { scene } = await createHierarchy();
      
      // Add comments and suggestions
      const comment = await prisma.comment.create({
        data: {
          sceneId: scene.id,
          author: 'user1',
          text: 'Comment'
        }
      });
      
      const suggestion = await prisma.suggestion.create({
        data: {
          sceneId: scene.id,
          author: 'user2',
          text: 'Suggestion',
          status: 'OPEN'
        }
      });
      
      const session = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: ['user1', 'user2'],
          active: true
        }
      });
      
      // Delete scene
      await prisma.scene.delete({ where: { id: scene.id } });
      
      // Verify children deleted
      const deletedComment = await prisma.comment.findUnique({
        where: { id: comment.id }
      });
      const deletedSuggestion = await prisma.suggestion.findUnique({
        where: { id: suggestion.id }
      });
      const deletedSession = await prisma.collabSession.findUnique({
        where: { id: session.id }
      });
      
      expect(deletedComment).toBeNull();
      expect(deletedSuggestion).toBeNull();
      expect(deletedSession).toBeNull();
    });
  });
});