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

describe('Foreign Key Relationships', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Relationships', () => {
    it('should cascade delete memberships when user is deleted', async () => {
      const testId = uniqueId();
      
      const user = await prisma.user.create({
        data: { email: `cascade-${testId}@test.com` }
      });
      
      const team = await prisma.team.create({
        data: {
          name: `Team ${testId}`,
          members: {
            create: { userId: user.id, role: 'OWNER' }
          }
        }
      });
      
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id }
      });
      expect(membership).toBeDefined();
      
      // Delete user should cascade delete membership
      await prisma.user.delete({ where: { id: user.id } });
      
      const deletedMembership = await prisma.membership.findFirst({
        where: { teamId: team.id }
      });
      expect(deletedMembership).toBeNull();
      
      // Clean up
      await prisma.team.delete({ where: { id: team.id } });
    });

    it('should cascade delete project members when user is deleted', async () => {
      const testId = uniqueId();
      
      const user = await prisma.user.create({
        data: { email: `project-member-${testId}@test.com` }
      });
      
      const project = await prisma.project.create({
        data: {
          name: `Project ${testId}`,
          slug: `project-${testId}`,
          members: {
            create: { userId: user.id, role: 'OWNER' }
          }
        }
      });
      
      const member = await prisma.projectMember.findFirst({
        where: { userId: user.id }
      });
      expect(member).toBeDefined();
      
      // Delete user should cascade delete project member
      await prisma.user.delete({ where: { id: user.id } });
      
      const deletedMember = await prisma.projectMember.findFirst({
        where: { projectId: project.id }
      });
      expect(deletedMember).toBeNull();
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Project Relationships', () => {
    it('should cascade delete all project children', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: {
          name: `Cascade Test ${testId}`,
          slug: `cascade-${testId}`,
          // Create nested structure (without scenes initially)
          books: {
            create: {
              title: 'Book',
              index: 0,
              chapters: {
                create: {
                  title: 'Chapter',
                  index: 0
                }
              }
            }
          },
          entities: {
            create: {
              type: 'CHARACTER',
              name: 'Character',
              facts: {
                create: {
                  fact: 'A fact',
                  revealState: 'PLANNED'
                }
              }
            }
          },
          runs: {
            create: {
              provider: 'test',
              model: 'test',
              action: 'TEST',
              promptObj: {},
              inputTokens: 0,
              outputTokens: 0,
              costUSD: 0,
              status: 'COMPLETE'
            }
          }
        }
      });
      
      // Create a scene with the proper projectId
      const chapter = await prisma.chapter.findFirst({
        where: { book: { projectId: project.id } }
      });
      
      if (chapter) {
        await prisma.scene.create({
          data: {
            chapterId: chapter.id,
            projectId: project.id,
            title: 'Scene',
            index: 0,
            contentMd: 'Content'
          }
        });
      }
      
      // Verify everything was created
      const fullProject = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          books: { include: { chapters: { include: { scenes: true } } } },
          entities: { include: { facts: true } },
          runs: true
        }
      });
      
      expect(fullProject?.books).toHaveLength(1);
      expect(fullProject?.entities).toHaveLength(1);
      expect(fullProject?.runs).toHaveLength(1);
      
      // Delete project should cascade delete everything
      await prisma.project.delete({ where: { id: project.id } });
      
      // Verify cascade deletion
      const deletedBook = await prisma.book.findFirst({
        where: { id: fullProject?.books[0].id }
      });
      expect(deletedBook).toBeNull();
      
      const deletedEntity = await prisma.entity.findFirst({
        where: { id: fullProject?.entities[0].id }
      });
      expect(deletedEntity).toBeNull();
    });
  });

  describe('Book -> Chapter -> Scene Relationships', () => {
    it('should maintain hierarchy constraints', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Hierarchy Test', slug: `hierarchy-${testId}` }
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
          title: 'Scene',
          index: 0,
          contentMd: 'Content'
        }
      });
      
      // Deleting book should cascade delete chapter and scene
      await prisma.book.delete({ where: { id: book.id } });
      
      const deletedChapter = await prisma.chapter.findUnique({
        where: { id: chapter.id }
      });
      expect(deletedChapter).toBeNull();
      
      const deletedScene = await prisma.scene.findUnique({
        where: { id: scene.id }
      });
      expect(deletedScene).toBeNull();
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });

    it('should enforce foreign key constraints', async () => {
      const testId = uniqueId();
      
      // Attempt to create scene with non-existent chapter should fail
      await expect(
        prisma.scene.create({
          data: {
            chapterId: 'non-existent-id',
            projectId: 'non-existent-id',
            title: 'Orphan Scene',
            index: 0,
            contentMd: 'Content'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Entity -> CanonFact Relationships', () => {
    it('should cascade delete facts when entity is deleted', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Entity Test', slug: `entity-${testId}` }
      });
      
      const entity = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'Character',
          facts: {
            create: [
              { fact: 'Fact 1', revealState: 'PLANNED' },
              { fact: 'Fact 2', revealState: 'REVEALED' }
            ]
          }
        }
      });
      
      const facts = await prisma.canonFact.findMany({
        where: { entityId: entity.id }
      });
      expect(facts).toHaveLength(2);
      
      // Delete entity should cascade delete facts
      await prisma.entity.delete({ where: { id: entity.id } });
      
      const deletedFacts = await prisma.canonFact.findMany({
        where: { entityId: entity.id }
      });
      expect(deletedFacts).toHaveLength(0);
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Scene Relationships', () => {
    it('should handle scene dependencies correctly', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Scene Deps', slug: `scene-deps-${testId}` }
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
          title: 'Scene',
          index: 0,
          contentMd: 'Content',
          // Add related data
          comments: {
            create: {
              author: 'user1',
              text: 'Comment',
              range: { start: 0, end: 5 }
            }
          },
          suggestions: {
            create: {
              author: 'user2',
              text: 'Suggestion',
              status: 'OPEN'
            }
          },
          collabSessions: {
            create: {
              users: ['user1', 'user2'],
              active: true
            }
          },
          snapshots: {
            create: {
              contentMd: 'Snapshot',
              version: 1
            }
          }
        }
      });
      
      // Verify all related data was created
      const fullScene = await prisma.scene.findUnique({
        where: { id: scene.id },
        include: {
          comments: true,
          suggestions: true,
          collabSessions: true,
          snapshots: true
        }
      });
      
      expect(fullScene?.comments).toHaveLength(1);
      expect(fullScene?.suggestions).toHaveLength(1);
      expect(fullScene?.collabSessions).toHaveLength(1);
      expect(fullScene?.snapshots).toHaveLength(1);
      
      // Delete scene should cascade delete all related data
      await prisma.scene.delete({ where: { id: scene.id } });
      
      const deletedComments = await prisma.comment.findMany({
        where: { sceneId: scene.id }
      });
      expect(deletedComments).toHaveLength(0);
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Refactor -> Patch -> Hunk -> EditSpan Relationships', () => {
    it('should maintain refactoring hierarchy', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Refactor Test', slug: `refactor-${testId}` }
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
          title: 'Scene',
          index: 0,
          contentMd: 'Content'
        }
      });
      
      const refactor = await prisma.refactor.create({
        data: {
          projectId: project.id,
          scopeType: 'SCENE',
          scopeId: scene.id,
          instruction: 'Test refactor',
          status: 'DRAFT',
          createdBy: 'user1',
          patches: {
            create: {
              sceneId: scene.id,
              status: 'PROPOSED',
              summary: 'Test patch',
              unifiedDiff: 'diff',
              confidence: 90,
              hunks: {
                create: {
                  status: 'PROPOSED',
                  summary: 'Test hunk',
                  unifiedDiff: 'diff',
                  confidence: 90,
                  editSpans: {
                    create: {
                      startChar: 0,
                      endChar: 5
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
      
      // Delete refactor should cascade delete everything
      await prisma.refactor.delete({ where: { id: refactor.id } });
      
      const deletedPatch = await prisma.patch.findFirst({
        where: { refactorId: refactor.id }
      });
      expect(deletedPatch).toBeNull();
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Run -> CostEvent Relationships', () => {
    it('should link runs with cost events', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Cost Test', slug: `cost-${testId}` }
      });
      
      const run = await prisma.run.create({
        data: {
          projectId: project.id,
          provider: 'openai',
          model: 'gpt-4',
          action: 'WRITE',
          promptObj: {},
          inputTokens: 100,
          outputTokens: 500,
          costUSD: 0.02,
          status: 'COMPLETE',
          costEvents: {
            create: {
              provider: 'openai',
              tokensIn: 100,
              tokensOut: 500,
              amount: 0.02
            }
          }
        },
        include: {
          costEvents: true
        }
      });
      
      expect(run.costEvents).toHaveLength(1);
      expect(run.costEvents[0].runId).toBe(run.id);
      
      // Delete run should cascade delete cost events
      await prisma.run.delete({ where: { id: run.id } });
      
      const deletedCostEvent = await prisma.costEvent.findFirst({
        where: { runId: run.id }
      });
      expect(deletedCostEvent).toBeNull();
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  describe('Team -> Membership Relationships', () => {
    it('should manage team memberships correctly', async () => {
      const testId = uniqueId();
      
      const user1 = await prisma.user.create({
        data: { email: `user1-${testId}@test.com` }
      });
      
      const user2 = await prisma.user.create({
        data: { email: `user2-${testId}@test.com` }
      });
      
      const team = await prisma.team.create({
        data: {
          name: `Team ${testId}`,
          members: {
            create: [
              { userId: user1.id, role: 'OWNER' },
              { userId: user2.id, role: 'WRITER' }
            ]
          }
        },
        include: {
          members: true
        }
      });
      
      expect(team.members).toHaveLength(2);
      
      // Delete team should cascade delete memberships
      await prisma.team.delete({ where: { id: team.id } });
      
      const deletedMemberships = await prisma.membership.findMany({
        where: { teamId: team.id }
      });
      expect(deletedMemberships).toHaveLength(0);
      
      // Clean up
      await prisma.user.deleteMany({
        where: { id: { in: [user1.id, user2.id] } }
      });
    });
  });

  describe('SceneEntity Join Table', () => {
    it('should handle many-to-many scene-entity relationships', async () => {
      const testId = uniqueId();
      
      const project = await prisma.project.create({
        data: { name: 'Join Test', slug: `join-${testId}` }
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
          title: 'Scene',
          index: 0,
          contentMd: 'Content'
        }
      });
      
      const entity1 = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'CHARACTER',
          name: 'Character 1'
        }
      });
      
      const entity2 = await prisma.entity.create({
        data: {
          projectId: project.id,
          type: 'LOCATION',
          name: 'Location 1'
        }
      });
      
      // Create scene-entity relationships
      await prisma.sceneEntity.createMany({
        data: [
          { sceneId: scene.id, entityId: entity1.id },
          { sceneId: scene.id, entityId: entity2.id }
        ]
      });
      
      const sceneEntities = await prisma.sceneEntity.findMany({
        where: { sceneId: scene.id }
      });
      
      expect(sceneEntities).toHaveLength(2);
      
      // Delete scene should cascade delete join table entries
      await prisma.scene.delete({ where: { id: scene.id } });
      
      const deletedSceneEntities = await prisma.sceneEntity.findMany({
        where: { sceneId: scene.id }
      });
      expect(deletedSceneEntities).toHaveLength(0);
      
      // Entities should still exist
      const entity1Still = await prisma.entity.findUnique({
        where: { id: entity1.id }
      });
      expect(entity1Still).toBeDefined();
      
      // Clean up
      await prisma.project.delete({ where: { id: project.id } });
    });
  });
});