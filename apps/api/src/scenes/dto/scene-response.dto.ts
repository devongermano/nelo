import type { Scene } from '@nelo/db';

/**
 * Response DTO for Scene entity
 * Matches the Prisma Scene model structure
 */
export interface SceneResponseDto extends Scene {
  // Interface extends Scene model from Prisma
  // All fields are properly typed through the Scene model
}