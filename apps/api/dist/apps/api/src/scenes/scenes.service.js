"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ScenesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@nelo/db");
const scene_concurrent_update_exception_1 = require("./exceptions/scene-concurrent-update.exception");
let ScenesService = ScenesService_1 = class ScenesService {
    constructor() {
        this.logger = new common_1.Logger(ScenesService_1.name);
    }
    async create(content, chapterId, projectId) {
        try {
            // Validate that the chapter and project exist
            const [chapter, project] = await Promise.all([
                db_1.prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }),
                db_1.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
            ]);
            if (!chapter) {
                throw new common_1.BadRequestException(`Chapter with ID ${chapterId} does not exist`);
            }
            if (!project) {
                throw new common_1.BadRequestException(`Project with ID ${projectId} does not exist`);
            }
            const scene = await db_1.prisma.scene.create({
                data: {
                    content,
                    chapterId,
                    projectId,
                    version: 1,
                },
            });
            this.logger.log(`Created scene with ID: ${scene.id}`);
            return scene;
        }
        catch (error) {
            if (this.isPrismaError(error)) {
                return this.handlePrismaError(error, 'create scene');
            }
            throw error;
        }
    }
    async find(id) {
        try {
            const scene = await db_1.prisma.scene.findUnique({
                where: { id },
            });
            if (!scene) {
                throw new common_1.NotFoundException(`Scene with ID ${id} not found`);
            }
            return scene;
        }
        catch (error) {
            if (this.isPrismaError(error)) {
                return this.handlePrismaError(error, 'find scene');
            }
            throw error;
        }
    }
    async update(id, content, order) {
        try {
            // Use a transaction to ensure atomicity and proper optimistic locking
            return await db_1.prisma.$transaction(async (tx) => {
                // First, get the current scene to check version
                const currentScene = await tx.scene.findUnique({
                    where: { id },
                });
                if (!currentScene) {
                    throw new common_1.NotFoundException(`Scene with ID ${id} not found`);
                }
                // Update with version check for optimistic locking
                const updatedScene = await tx.scene.update({
                    where: {
                        id,
                        version: currentScene.version, // This ensures optimistic locking
                    },
                    data: {
                        content: content !== undefined ? content : currentScene.content,
                        order: order !== undefined ? order : currentScene.order,
                        version: {
                            increment: 1,
                        },
                    },
                });
                this.logger.log(`Updated scene with ID: ${id}, new version: ${updatedScene.version}`);
                return updatedScene;
            });
        }
        catch (error) {
            if (this.isPrismaError(error)) {
                if (error.code === 'P2025') {
                    // This specifically handles optimistic locking failures
                    throw new scene_concurrent_update_exception_1.SceneConcurrentUpdateException(id);
                }
                return this.handlePrismaError(error, 'update scene');
            }
            throw error;
        }
    }
    async getSceneById(id) {
        try {
            const scene = await db_1.prisma.scene.findUnique({ where: { id } });
            if (!scene) {
                throw new common_1.NotFoundException(`Scene with ID ${id} not found`);
            }
            return scene;
        }
        catch (error) {
            if (this.isPrismaError(error)) {
                return this.handlePrismaError(error, 'get scene');
            }
            throw error;
        }
    }
    /**
     * Type guard to check if error is a Prisma error
     */
    isPrismaError(error) {
        return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
    }
    /**
     * Centralized Prisma error handling to convert database errors to appropriate NestJS exceptions
     */
    handlePrismaError(error, operation) {
        this.logger.error(`Prisma error during ${operation}: ${error.code} - ${error.message}`);
        switch (error.code) {
            case 'P2025':
                // Record not found
                throw new common_1.NotFoundException('The requested resource was not found');
            case 'P2002':
                // Unique constraint violation
                const target = error.meta?.target;
                const fields = target ? target.join(', ') : 'field(s)';
                throw new common_1.ConflictException(`A record with the same ${fields} already exists`);
            case 'P2003':
                // Foreign key constraint violation
                const field = error.meta?.field_name;
                const message = field
                    ? `Invalid reference: ${field} does not exist`
                    : 'Invalid reference to related record';
                throw new common_1.BadRequestException(message);
            case 'P2034':
                // Transaction conflict (optimistic locking)
                throw new common_1.ConflictException('The operation failed due to a concurrent update. Please retry.');
            default:
                // Log unknown Prisma errors and throw a generic error
                this.logger.error(`Unhandled Prisma error code: ${error.code}`, error);
                throw new common_1.BadRequestException('A database error occurred while processing your request');
        }
    }
};
exports.ScenesService = ScenesService;
exports.ScenesService = ScenesService = ScenesService_1 = __decorate([
    (0, common_1.Injectable)()
], ScenesService);
