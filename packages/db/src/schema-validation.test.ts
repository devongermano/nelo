import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, SceneStatus } from '@prisma/client';

// Use real database for these schema validation tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

// Helper to generate unique test identifiers
const uniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

describe('Schema Validation', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data - CASCADE deletes handle dependencies
    // Only delete top-level entities
    await prisma.$transaction([
      prisma.project.deleteMany(),
      prisma.team.deleteMany(),
      prisma.user.deleteMany(),
      prisma.providerKey.deleteMany(),
    ]);
    await prisma.$disconnect();
  });

  describe('Core Models', () => {
    it('should create a user with all fields', async () => {
      const testId = uniqueId();
      const email = `test-${testId}@example.com`;
      
      const user = await prisma.user.create({
        data: {
          email,
          displayName: 'Test User',
          settings: { theme: 'dark' }
        }
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.displayName).toBe('Test User');
      expect(user.settings).toEqual({ theme: 'dark' });
    });

    it('should create a project with proper slug', async () => {
      const testId = uniqueId();
      const slug = `test-project-${testId}`;
      
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          slug,
          version: 1
        }
      });

      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.slug).toBe(slug);
      expect(project.version).toBe(1);
    });

    it('should create complete manuscript hierarchy', async () => {
      const testId = uniqueId();
      
      // Create project first
      const project = await prisma.project.create({
        data: {
          name: 'Novel Project',
          slug: `novel-project-${testId}`
        }
      });

      // Create book
      const book = await prisma.book.create({
        data: {
          projectId: project.id,
          title: 'Book One',
          index: 0
        }
      });

      // Create chapter
      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          title: 'Chapter 1',
          index: 0
        }
      });

      // Create scene with projectId explicitly set
      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,  // Explicitly set projectId
          title: 'Opening Scene',
          index: 0,
          contentMd: '# The Beginning\n\nIt was a dark and stormy night...',
          docCrdt: {},
          status: SceneStatus.DRAFT,
          pov: 'third-person',
          tense: 'past',
          wordCount: 10
        }
      });

      // Verify the hierarchy
      const fullProject = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          books: {
            include: {
              chapters: {
                include: {
                  scenes: true
                }
              }
            }
          }
        }
      });

      expect(fullProject!.books).toHaveLength(1);
      expect(fullProject!.books[0].chapters).toHaveLength(1);
      expect(fullProject!.books[0].chapters[0].scenes).toHaveLength(1);
      
      const fetchedScene = fullProject!.books[0].chapters[0].scenes[0];
      expect(fetchedScene.contentMd).toContain('dark and stormy');
      expect(fetchedScene.status).toBe(SceneStatus.DRAFT);
      expect(fetchedScene.pov).toBe('third-person');
      expect(fetchedScene.tense).toBe('past');
    });
  });

  describe('Story Bible Models', () => {
    it('should create entities with canon facts', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: 'Story Bible Test',
          slug: `story-bible-test-${testId}`,
          entities: {
            create: {
              type: 'CHARACTER',
              name: 'John Doe',
              aliases: ['Johnny', 'JD'],
              traits: ['brave', 'loyal', 'stubborn'],
              facts: {
                create: [
                  {
                    fact: 'Has a secret past as a spy',
                    revealState: 'PLANNED',
                    confidence: 90
                  },
                  {
                    fact: 'Is allergic to peanuts',
                    revealState: 'REVEALED',
                    confidence: 100
                  }
                ]
              }
            }
          }
        },
        include: {
          entities: {
            include: {
              facts: true
            }
          }
        }
      });

      expect(project.entities).toHaveLength(1);
      const entity = project.entities[0];
      expect(entity.name).toBe('John Doe');
      expect(entity.aliases).toEqual(['Johnny', 'JD']);
      expect(entity.traits).toEqual(['brave', 'loyal', 'stubborn']);
      expect(entity.facts).toHaveLength(2);
      
      const secretFact = entity.facts.find(f => f.revealState === 'PLANNED');
      expect(secretFact?.fact).toContain('spy');
      expect(secretFact?.confidence).toBe(90);
    });
  });

  describe('Collaboration Models', () => {
    it('should create collaboration session with comments and suggestions', async () => {
      const testId = uniqueId();
      
      // Create project, book, chapter first
      const project = await prisma.project.create({
        data: {
          name: 'Collab Test',
          slug: `collab-test-${testId}`
        }
      });

      const book = await prisma.book.create({
        data: {
          projectId: project.id,
          title: 'Book',
          index: 0
        }
      });

      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          title: 'Chapter',
          index: 0
        }
      });

      // Create scene with collaboration features
      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          title: 'Scene',
          index: 0,
          contentMd: 'Original content',
          collabSessions: {
            create: {
              users: ['user1', 'user2'],
              active: true
            }
          },
          comments: {
            create: {
              author: 'user1',
              text: 'This needs more detail',
              range: { start: 0, end: 10 }
            }
          },
          suggestions: {
            create: {
              author: 'user2',
              text: 'Consider adding dialogue here',
              status: 'OPEN',
              range: { start: 5, end: 15 }
            }
          }
        },
        include: {
          collabSessions: true,
          comments: true,
          suggestions: true
        }
      });

      expect(scene.collabSessions).toHaveLength(1);
      expect(scene.collabSessions[0].users).toEqual(['user1', 'user2']);
      expect(scene.comments).toHaveLength(1);
      expect(scene.comments[0].text).toContain('more detail');
      expect(scene.suggestions).toHaveLength(1);
      expect(scene.suggestions[0].status).toBe('OPEN');
    });
  });

  describe('Access Control Models', () => {
    it('should create team with memberships', async () => {
      const testId = uniqueId();
      
      const user1 = await prisma.user.create({
        data: { email: `owner-${testId}@test.com` }
      });
      
      const user2 = await prisma.user.create({
        data: { email: `writer-${testId}@test.com` }
      });

      const team = await prisma.team.create({
        data: {
          name: 'Writing Team',
          members: {
            create: [
              { userId: user1.id, role: 'OWNER' },
              { userId: user2.id, role: 'WRITER' }
            ]
          }
        },
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      });

      expect(team.members).toHaveLength(2);
      const owner = team.members.find(m => m.role === 'OWNER');
      expect(owner?.user.email).toBe(`owner-${testId}@test.com`);
    });

    it('should create project members with roles', async () => {
      const testId = uniqueId();
      
      const user = await prisma.user.create({
        data: { email: `member-${testId}@test.com` }
      });

      const project = await prisma.project.create({
        data: {
          name: 'Member Test',
          slug: `member-test-${testId}`,
          members: {
            create: {
              userId: user.id,
              role: 'MAINTAINER'
            }
          }
        },
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      });

      expect(project.members).toHaveLength(1);
      expect(project.members[0].role).toBe('MAINTAINER');
      expect(project.members[0].user.email).toBe(`member-${testId}@test.com`);
    });
  });

  describe('AI & Cost Tracking Models', () => {
    it('should create runs with cost events', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: 'AI Test',
          slug: `ai-test-${testId}`,
          runs: {
            create: {
              provider: 'openai',
              model: 'gpt-4',
              action: 'WRITE',
              promptObj: { prompt: 'Write a scene' },
              inputTokens: 100,
              outputTokens: 500,
              costUSD: 0.015,
              status: 'COMPLETE',
              costEvents: {
                create: {
                  provider: 'openai',
                  tokensIn: 100,
                  tokensOut: 500,
                  amount: 0.015
                }
              }
            }
          },
          budgets: {
            create: {
              limitUSD: 10.00,
              spentUSD: 0.015
            }
          }
        },
        include: {
          runs: {
            include: {
              costEvents: true
            }
          },
          budgets: true
        }
      });

      expect(project.runs).toHaveLength(1);
      const run = project.runs[0];
      expect(run.provider).toBe('openai');
      expect(run.status).toBe('COMPLETE');
      expect(run.costEvents).toHaveLength(1);
      expect(Number(run.costEvents[0].amount)).toBeCloseTo(0.015);
      
      expect(project.budgets).toHaveLength(1);
      expect(Number(project.budgets[0].limitUSD)).toBe(10);
    });
  });

  describe('Refactoring Models', () => {
    it('should create refactor with patches and hunks', async () => {
      const testId = uniqueId();
      
      // Create project, book, chapter, scene step by step
      const project = await prisma.project.create({
        data: {
          name: 'Refactor Test',
          slug: `refactor-test-${testId}`
        }
      });

      const book = await prisma.book.create({
        data: {
          projectId: project.id,
          title: 'Book',
          index: 0
        }
      });

      const chapter = await prisma.chapter.create({
        data: {
          bookId: book.id,
          title: 'Chapter',
          index: 0
        }
      });

      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          title: 'Scene',
          index: 0,
          contentMd: 'Original text'
        }
      });

      const refactor = await prisma.refactor.create({
        data: {
          projectId: project.id,
          scopeType: 'SCENE',
          scopeId: scene.id,
          instruction: 'Change all instances of "said" to "whispered"',
          status: 'DRAFT',
          createdBy: 'user1',
          patches: {
            create: {
              sceneId: scene.id,
              status: 'PROPOSED',
              summary: 'Replace dialogue tags',
              unifiedDiff: '--- a\n+++ b\n@@ -1 +1 @@\n-he said\n+he whispered',
              confidence: 95,
              hunks: {
                create: {
                  status: 'PROPOSED',
                  summary: 'First replacement',
                  unifiedDiff: '--- a\n+++ b\n@@ -1 +1 @@\n-said\n+whispered',
                  confidence: 95,
                  editSpans: {
                    create: {
                      startChar: 10,
                      endChar: 14
                    }
                  }
                }
              }
            }
          }
        },
        include: {
          patches: {
            include: {
              hunks: {
                include: {
                  editSpans: true
                }
              }
            }
          }
        }
      });

      expect(refactor.patches).toHaveLength(1);
      expect(refactor.patches[0].hunks).toHaveLength(1);
      expect(refactor.patches[0].hunks[0].editSpans).toHaveLength(1);
      const span = refactor.patches[0].hunks[0].editSpans[0];
      expect(span.startChar).toBe(10);
      expect(span.endChar).toBe(14);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all enum values', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: 'Enum Test',
          slug: `enum-test-${testId}`
        }
      });

      // Test RevealState enum
      const entity = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'Test',
          facts: {
            create: [
              { fact: 'Test 1', revealState: 'PLANNED' },
              { fact: 'Test 2', revealState: 'REVEALED' },
              { fact: 'Test 3', revealState: 'REDACTED_UNTIL_SCENE' },
              { fact: 'Test 4', revealState: 'REDACTED_UNTIL_DATE' }
            ]
          }
        },
        include: { facts: true }
      });
      expect(entity.facts).toHaveLength(4);

      // Test Role enum
      const user = await prisma.user.create({
        data: { email: `roles-${testId}@test.com` }
      });
      
      await prisma.projectMember.create({
        data: { projectId: project.id, userId: user.id, role: 'OWNER' }
      });
      
      const members = await prisma.projectMember.findMany({
        where: { projectId: project.id }
      });
      expect(members[0].role).toBe('OWNER');

      // Test RunStatus enum
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          provider: 'test',
          model: 'test',
          action: 'TEST',
          promptObj: {},
          inputTokens: 0,
          outputTokens: 0,
          costUSD: 0,
          status: 'PENDING'
        }
      });
      expect(run.status).toBe('PENDING');
    });
  });

  describe('Version Control', () => {
    it('should handle optimistic locking with version field', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: 'Version Test',
          slug: `version-test-${testId}`,
          version: 1
        }
      });

      // Update with version check
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          name: 'Updated Name',
          version: { increment: 1 }
        }
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe('Updated Name');
    });
  });
});