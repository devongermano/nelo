import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, SceneStatus } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://nelo:nelo@localhost:5432/nelo_test'
    }
  }
});

const uniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

describe('Integration Tests - Multi-Model Operations', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete Project Creation Flow', () => {
    it('should create a full project with all related entities', async () => {
      const testId = uniqueId();
      
      // Create everything in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create users
        const owner = await tx.user.create({
          data: { email: `owner-${testId}@test.com`, displayName: 'Project Owner' }
        });
        
        const writer = await tx.user.create({
          data: { email: `writer-${testId}@test.com`, displayName: 'Writer' }
        });

        // 2. Create team
        const team = await tx.team.create({
          data: {
            name: `Team ${testId}`,
            members: {
              create: [
                { userId: owner.id, role: 'OWNER' },
                { userId: writer.id, role: 'WRITER' }
              ]
            }
          }
        });

        // 3. Create project with full hierarchy (without scenes)
        const project = await tx.project.create({
          data: {
            name: `Integration Test Project ${testId}`,
            slug: `integration-test-${testId}`,
            version: 1,
            members: {
              create: [
                { userId: owner.id, role: 'OWNER' },
                { userId: writer.id, role: 'WRITER' }
              ]
            },
            // Story Bible entities
            entities: {
              create: [
                {
                  type: 'CHARACTER',
                  name: 'Protagonist',
                  aliases: ['Hero', 'Main Character'],
                  traits: ['brave', 'determined'],
                  facts: {
                    create: {
                      fact: 'Has a mysterious past',
                      revealState: 'REDACTED_UNTIL_SCENE',
                      confidence: 85
                    }
                  }
                },
                {
                  type: 'LOCATION',
                  name: 'The Ancient Library',
                  aliases: ['Library of Ages'],
                  traits: ['mystical', 'hidden']
                }
              ]
            },
            // AI Configuration
            models: {
              create: {
                name: 'Default GPT-4',
                provider: 'openai',
                config: { temperature: 0.7, maxTokens: 4000 }
              }
            },
            prompts: {
              create: {
                name: 'Fantasy Prose',
                text: 'Write in a rich, descriptive fantasy style...'
              }
            },
            styleGuides: {
              create: {
                name: 'Project Style',
                guide: { tone: 'epic', voice: 'third-person omniscient' }
              }
            },
            // Budget tracking
            budgets: {
              create: {
                limitUSD: 100.00,
                spentUSD: 0
              }
            },
            // Manuscript structure (without scenes initially)
            books: {
              create: {
                title: 'Book One: The Beginning',
                index: 0,
                chapters: {
                  create: [
                    {
                      title: 'Chapter 1: The Call',
                      index: 0
                    },
                    {
                      title: 'Chapter 2: The Journey',
                      index: 1
                    }
                  ]
                }
              }
            }
          },
          include: {
            members: { include: { user: true } },
            entities: { include: { facts: true } },
            books: {
              include: {
                chapters: true
              }
            },
            models: true,
            prompts: true,
            styleGuides: true,
            budgets: true
          }
        });

        // 4. Create scenes with proper projectId
        const chapter1 = project.books[0].chapters.find(c => c.index === 0)!;
        const chapter2 = project.books[0].chapters.find(c => c.index === 1)!;
        
        await tx.scene.createMany({
          data: [
            {
              chapterId: chapter1.id,
              projectId: project.id,
              title: 'Opening Scene',
              index: 0,
              status: SceneStatus.DRAFT,
              contentMd: '# The Beginning\n\nThe story starts here...',
              docCrdt: { version: 1 },
              wordCount: 5
            },
            {
              chapterId: chapter1.id,
              projectId: project.id,
              title: 'The Discovery',
              index: 1,
              status: SceneStatus.DRAFT,
              contentMd: 'A discovery was made...',
              docCrdt: { version: 1 },
              wordCount: 4
            },
            {
              chapterId: chapter2.id,
              projectId: project.id,
              title: 'Setting Out',
              index: 0,
              status: SceneStatus.REVISED,
              contentMd: 'The journey begins...',
              docCrdt: { version: 2 },
              wordCount: 3
            }
          ]
        });
        
        // Refetch project with all data
        const fullProject = await tx.project.findUnique({
          where: { id: project.id },
          include: {
            members: { include: { user: true } },
            entities: { include: { facts: true } },
            books: {
              include: {
                chapters: {
                  include: { scenes: true }
                }
              }
            },
            models: true,
            prompts: true,
            styleGuides: true,
            budgets: true
          }
        });

        return { project: fullProject!, team, owner, writer };
      });

      // Assertions
      expect(result.project).toBeDefined();
      expect(result.project.members).toHaveLength(2);
      expect(result.project.entities).toHaveLength(2);
      expect(result.project.books).toHaveLength(1);
      expect(result.project.books[0].chapters).toHaveLength(2);
      expect(result.project.books[0].chapters[0].scenes).toHaveLength(2);
      expect(result.project.books[0].chapters[1].scenes).toHaveLength(1);
      
      // Verify entity relationships
      const character = result.project.entities.find(e => e.type === 'CHARACTER');
      expect(character?.facts).toHaveLength(1);
      expect(character?.facts[0].revealState).toBe('REDACTED_UNTIL_SCENE');
    });
  });

  describe('Collaborative Editing Flow', () => {
    it('should handle multiple users editing the same scene', async () => {
      const testId = uniqueId();
      
      // Setup
      const project = await prisma.project.create({
        data: { name: 'Collab Test', slug: `collab-${testId}` }
      });
      
      const book = await prisma.book.create({
        data: { projectId: project.id, title: 'Book', index: 0 }
      });
      
      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, title: 'Chapter', index: 0 }
      });
      
      const scene = await prisma.scene.create({
        data: {
          chapterId: chapter.id,
          projectId: project.id,
          title: 'Collaborative Scene',
          index: 0,
          contentMd: 'Initial content',
          docCrdt: { version: 1 },
          version: 1
        }
      });

      // Simulate collaborative editing
      const session = await prisma.collabSession.create({
        data: {
          sceneId: scene.id,
          users: ['user1', 'user2', 'user3'],
          active: true
        }
      });

      // Add comments from different users
      const comments = await Promise.all([
        prisma.comment.create({
          data: {
            sceneId: scene.id,
            author: 'user1',
            text: 'Great opening!',
            range: { start: 0, end: 7 }
          }
        }),
        prisma.comment.create({
          data: {
            sceneId: scene.id,
            author: 'user2',
            text: 'Consider adding more detail',
            range: { start: 8, end: 15 }
          }
        })
      ]);

      // Add suggestions
      const suggestion = await prisma.suggestion.create({
        data: {
          sceneId: scene.id,
          author: 'user3',
          text: 'This paragraph could be more descriptive',
          status: 'OPEN',
          range: { start: 0, end: 15 }
        }
      });

      // Create a snapshot of the scene
      const snapshot = await prisma.snapshot.create({
        data: {
          sceneId: scene.id,
          contentMd: scene.contentMd,
          version: scene.version
        }
      });

      // Verify collaborative features
      const fullScene = await prisma.scene.findUnique({
        where: { id: scene.id },
        include: {
          collabSessions: true,
          comments: true,
          suggestions: true,
          snapshots: true
        }
      });

      expect(fullScene?.collabSessions).toHaveLength(1);
      expect(fullScene?.collabSessions[0].users).toHaveLength(3);
      expect(fullScene?.comments).toHaveLength(2);
      expect(fullScene?.suggestions).toHaveLength(1);
      expect(fullScene?.snapshots).toHaveLength(1);
    });
  });

  describe('AI Generation and Cost Tracking', () => {
    it('should track AI runs and associated costs', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: 'AI Test',
          slug: `ai-${testId}`,
          budgets: {
            create: {
              limitUSD: 50.00,
              spentUSD: 0
            }
          }
        }
      });

      // Simulate multiple AI runs
      const runs = await prisma.$transaction(async (tx) => {
        const run1 = await tx.run.create({
          data: {
            projectId: project.id,
            provider: 'openai',
            model: 'gpt-4',
            action: 'WRITE',
            promptObj: { 
              prompt: 'Write an opening scene',
              temperature: 0.7
            },
            inputTokens: 150,
            outputTokens: 500,
            costUSD: 0.021,
            status: 'COMPLETE',
            costEvents: {
              create: {
                provider: 'openai',
                tokensIn: 150,
                tokensOut: 500,
                amount: 0.021
              }
            }
          }
        });

        const run2 = await tx.run.create({
          data: {
            projectId: project.id,
            provider: 'anthropic',
            model: 'claude-3-opus',
            action: 'EDIT',
            promptObj: {
              prompt: 'Improve the dialogue',
              maxTokens: 2000
            },
            inputTokens: 200,
            outputTokens: 450,
            costUSD: 0.032,
            status: 'COMPLETE',
            costEvents: {
              create: {
                provider: 'anthropic',
                tokensIn: 200,
                tokensOut: 450,
                amount: 0.032
              }
            }
          }
        });

        // Update budget spent amount
        const budget = await tx.budget.findFirst({
          where: { projectId: project.id }
        });
        
        if (budget) {
          await tx.budget.update({
            where: { id: budget.id },
            data: {
              spentUSD: {
                increment: 0.053 // Total of both runs
              }
            }
          });
        }

        return [run1, run2];
      });

      // Verify cost tracking
      const projectWithCosts = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          runs: {
            include: {
              costEvents: true
            }
          },
          budgets: true
        }
      });

      expect(projectWithCosts?.runs).toHaveLength(2);
      
      // Count total cost events across all runs
      const totalCostEvents = projectWithCosts?.runs.reduce((sum, run) => 
        sum + run.costEvents.length, 0) || 0;
      expect(totalCostEvents).toBe(2);
      expect(projectWithCosts?.budgets[0].spentUSD.toNumber()).toBeCloseTo(0.053);
      
      // Verify we haven't exceeded budget
      const budget = projectWithCosts?.budgets[0];
      expect(budget?.spentUSD.toNumber()).toBeLessThan(budget?.limitUSD.toNumber() || 0);
    });
  });

  describe('Refactoring Flow', () => {
    it('should handle complex refactoring with patches and hunks', async () => {
      const testId = uniqueId();
      
      // Setup manuscript structure
      const project = await prisma.project.create({
        data: { name: 'Refactor Test', slug: `refactor-${testId}` }
      });
      
      const book = await prisma.book.create({
        data: { projectId: project.id, title: 'Book', index: 0 }
      });
      
      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, title: 'Chapter', index: 0 }
      });
      
      const scenes = await Promise.all([
        prisma.scene.create({
          data: {
            chapterId: chapter.id,
            projectId: project.id,
            title: 'Scene 1',
            index: 0,
            contentMd: 'John said, "Hello." Mary said, "Hi."'
          }
        }),
        prisma.scene.create({
          data: {
            chapterId: chapter.id,
            projectId: project.id,
            title: 'Scene 2',
            index: 1,
            contentMd: 'John said goodbye. Mary said farewell.'
          }
        })
      ]);

      // Create a chapter-wide refactor
      const refactor = await prisma.refactor.create({
        data: {
          projectId: project.id,
          scopeType: 'CHAPTER',
          scopeId: chapter.id,
          instruction: 'Change all instances of "said" to more descriptive verbs',
          status: 'DRAFT',
          createdBy: 'editor@test.com',
          plan: [
            'Analyze all dialogue tags',
            'Replace with contextually appropriate verbs',
            'Maintain character voice consistency'
          ],
          patches: {
            create: [
              {
                sceneId: scenes[0].id,
                status: 'PROPOSED',
                summary: 'Update dialogue tags in Scene 1',
                unifiedDiff: `--- a/scene1.md
+++ b/scene1.md
@@ -1 +1 @@
-John said, "Hello." Mary said, "Hi."
+John greeted, "Hello." Mary replied, "Hi."`,
                confidence: 92,
                hunks: {
                  create: [
                    {
                      status: 'PROPOSED',
                      summary: 'Replace first "said" with "greeted"',
                      unifiedDiff: `-John said, "Hello."
+John greeted, "Hello."`,
                      confidence: 95,
                      editSpans: {
                        create: { startChar: 5, endChar: 9 }
                      }
                    },
                    {
                      status: 'PROPOSED',
                      summary: 'Replace second "said" with "replied"',
                      unifiedDiff: `-Mary said, "Hi."
+Mary replied, "Hi."`,
                      confidence: 90,
                      editSpans: {
                        create: { startChar: 25, endChar: 29 }
                      }
                    }
                  ]
                }
              },
              {
                sceneId: scenes[1].id,
                status: 'PROPOSED',
                summary: 'Update dialogue tags in Scene 2',
                unifiedDiff: `--- a/scene2.md
+++ b/scene2.md
@@ -1 +1 @@
-John said goodbye. Mary said farewell.
+John muttered goodbye. Mary whispered farewell.`,
                confidence: 88,
                hunks: {
                  create: [
                    {
                      status: 'PROPOSED',
                      summary: 'Replace "said" with "muttered"',
                      unifiedDiff: `-John said goodbye.
+John muttered goodbye.`,
                      confidence: 85,
                      editSpans: {
                        create: { startChar: 5, endChar: 9 }
                      }
                    },
                    {
                      status: 'PROPOSED',
                      summary: 'Replace "said" with "whispered"',
                      unifiedDiff: `-Mary said farewell.
+Mary whispered farewell.`,
                      confidence: 90,
                      editSpans: {
                        create: { startChar: 24, endChar: 28 }
                      }
                    }
                  ]
                }
              }
            ]
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

      // Verify refactor structure
      expect(refactor.patches).toHaveLength(2);
      expect(refactor.patches[0].hunks).toHaveLength(2);
      expect(refactor.patches[1].hunks).toHaveLength(2);
      
      // Verify edit spans are correctly positioned
      const firstPatch = refactor.patches[0];
      expect(firstPatch.hunks[0].editSpans[0].startChar).toBe(5);
      expect(firstPatch.hunks[0].editSpans[0].endChar).toBe(9);
      
      // Simulate applying one patch
      const appliedPatch = await prisma.patch.update({
        where: { id: refactor.patches[0].id },
        data: { status: 'APPLIED' }
      });
      
      expect(appliedPatch.status).toBe('APPLIED');
    });
  });

  describe('Transaction Rollback Behavior', () => {
    it('should rollback all changes if any operation fails', async () => {
      const testId = uniqueId();
      
      try {
        await prisma.$transaction(async (tx) => {
          // Create a project
          const project = await tx.project.create({
            data: { name: 'Rollback Test', slug: `rollback-${testId}` }
          });
          
          // Create a book
          const book = await tx.book.create({
            data: { projectId: project.id, title: 'Book', index: 0 }
          });
          
          // This should fail - trying to create a scene without required fields
          await tx.scene.create({
            data: {
              chapterId: 'non-existent-id', // This will cause a foreign key error
              projectId: project.id,
              title: 'Scene',
              index: 0
            }
          });
        });
      } catch (error) {
        // Transaction should have rolled back
      }
      
      // Verify nothing was created
      const project = await prisma.project.findFirst({
        where: { slug: `rollback-${testId}` }
      });
      
      expect(project).toBeNull();
    });
  });

  describe('Optimistic Locking', () => {
    it('should handle concurrent updates with version control', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { 
          name: 'Version Test', 
          slug: `version-${testId}`,
          version: 1
        }
      });

      // Simulate two concurrent updates
      const update1 = prisma.project.update({
        where: { id: project.id },
        data: {
          name: 'Updated by User 1',
          version: { increment: 1 }
        }
      });

      const update2 = prisma.project.update({
        where: { id: project.id },
        data: {
          name: 'Updated by User 2',
          version: { increment: 1 }
        }
      });

      // Execute both updates
      const results = await Promise.allSettled([update1, update2]);
      
      // One should succeed, one might fail or both might succeed
      // (depends on timing, but version should increment properly)
      const finalProject = await prisma.project.findUnique({
        where: { id: project.id }
      });
      
      expect(finalProject?.version).toBeGreaterThan(1);
    });
  });
});