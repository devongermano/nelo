import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { prisma, type Scene, type Prisma, SceneStatus } from '@nelo/db';
import { SceneConcurrentUpdateException } from './exceptions/scene-concurrent-update.exception';

// Transaction client type from Prisma
type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class ScenesService {
  private readonly logger = new Logger(ScenesService.name);
  async create(contentMd: string, chapterId: string, projectId: string): Promise<Scene> {
    try {
      // Validate that the chapter and project exist
      const [chapter, project] = await Promise.all([
        prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }),
        prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
      ]);

      if (!chapter) {
        throw new BadRequestException(`Chapter with ID ${chapterId} does not exist`);
      }

      if (!project) {
        throw new BadRequestException(`Project with ID ${projectId} does not exist`);
      }

      // Get the next index for the scene
      const lastScene = await prisma.scene.findFirst({
        where: { chapterId },
        orderBy: { index: 'desc' },
        select: { index: true }
      });
      const nextIndex = (lastScene?.index ?? -1) + 1;

      const scene = await prisma.scene.create({
        data: {
          contentMd,
          chapterId,
          projectId,
          index: nextIndex,
          status: SceneStatus.DRAFT,
          docCrdt: {},
          wordCount: contentMd ? contentMd.split(/\s+/).length : 0,
          version: 1,
        },
      });

      this.logger.log(`Created scene with ID: ${scene.id}`);
      return scene;
    } catch (error) {
      if (this.isPrismaError(error)) {
        return this.handlePrismaError(error, 'create scene');
      }
      throw error;
    }
  }

  async find(id: string): Promise<Scene> {
    try {
      const scene = await prisma.scene.findUnique({ 
        where: { id },
      });
      if (!scene) {
        throw new NotFoundException(`Scene with ID ${id} not found`);
      }
      return scene;
    } catch (error) {
      if (this.isPrismaError(error)) {
        return this.handlePrismaError(error, 'find scene');
      }
      throw error;
    }
  }

  async update(id: string, contentMd?: string, order?: number): Promise<Scene> {
    try {
      // Use a transaction to ensure atomicity and proper optimistic locking
      return await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // First, get the current scene to check version
        const currentScene = await tx.scene.findUnique({
          where: { id },
        });
        
        if (!currentScene) {
          throw new NotFoundException(`Scene with ID ${id} not found`);
        }
        
        // Update with version check for optimistic locking
        const updatedScene = await tx.scene.update({
          where: { 
            id,
            version: currentScene.version, // This ensures optimistic locking
          },
          data: {
            contentMd: contentMd !== undefined ? contentMd : currentScene.contentMd,
            order: order !== undefined ? order : currentScene.order,
            wordCount: contentMd !== undefined ? (contentMd ? contentMd.split(/\s+/).length : 0) : currentScene.wordCount,
            version: {
              increment: 1,
            },
          },
        });
        
        this.logger.log(`Updated scene with ID: ${id}, new version: ${updatedScene.version}`);
        return updatedScene;
      });
    } catch (error) {
      if (this.isPrismaError(error)) {
        if (error.code === 'P2025') {
          // This specifically handles optimistic locking failures
          throw new SceneConcurrentUpdateException(id);
        }
        return this.handlePrismaError(error, 'update scene');
      }
      throw error;
    }
  }

  async getSceneById(id: string): Promise<Scene> {
    try {
      const scene = await prisma.scene.findUnique({ where: { id } });
      if (!scene) {
        throw new NotFoundException(`Scene with ID ${id} not found`);
      }
      return scene;
    } catch (error) {
      if (this.isPrismaError(error)) {
        return this.handlePrismaError(error, 'get scene');
      }
      throw error;
    }
  }

  /**
   * Type guard to check if error is a Prisma error
   */
  private isPrismaError(error: unknown): error is { code: string; meta?: any; message: string } {
    return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
  }

  /**
   * Centralized Prisma error handling to convert database errors to appropriate NestJS exceptions
   */
  private handlePrismaError(error: { code: string; meta?: any; message: string }, operation: string): never {
    this.logger.error(`Prisma error during ${operation}: ${error.code} - ${error.message}`);
    
    switch (error.code) {
      case 'P2025':
        // Record not found
        throw new NotFoundException('The requested resource was not found');
      
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        const fields = target ? target.join(', ') : 'field(s)';
        throw new ConflictException(`A record with the same ${fields} already exists`);
      
      case 'P2003':
        // Foreign key constraint violation
        const field = error.meta?.field_name as string | undefined;
        const message = field 
          ? `Invalid reference: ${field} does not exist`
          : 'Invalid reference to related record';
        throw new BadRequestException(message);
      
      case 'P2034':
        // Transaction conflict (optimistic locking)
        throw new ConflictException('The operation failed due to a concurrent update. Please retry.');
      
      default:
        // Log unknown Prisma errors and throw a generic error
        this.logger.error(`Unhandled Prisma error code: ${error.code}`, error);
        throw new BadRequestException('A database error occurred while processing your request');
    }
  }
}
