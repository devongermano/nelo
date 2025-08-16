import { ConflictException } from '@nestjs/common';

export class SceneConcurrentUpdateException extends ConflictException {
  constructor(sceneId?: string) {
    const message = sceneId 
      ? `Scene with ID ${sceneId} was modified by another user. Please refresh and try again.`
      : 'Scene was modified by another user. Please refresh and try again.';
    
    super(message);
  }
}