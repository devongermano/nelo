import {
  Controller,
  UseInterceptors,
  PreconditionFailedException,
} from '@nestjs/common';
import { TypedRoute, TypedBody, TypedParam } from '@nestia/core';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { ScenesService } from './scenes.service';
import { IfMatchHeader } from '../common/if-match-header.decorator';

@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @UseInterceptors(IdempotencyInterceptor)
  @TypedRoute.Post()
  async create(@TypedBody() dto: CreateSceneDto) {
    const { contentMd, chapterId, projectId } = dto;
    return this.scenesService.create(contentMd, chapterId, projectId);
  }

  @TypedRoute.Patch(':id')
  async update(
    @TypedParam('id') id: string,
    @IfMatchHeader() ifMatch: string,
    @TypedBody() dto: UpdateSceneDto,
  ) {
    // First verify the version matches what the client expects
    const currentScene = await this.scenesService.find(id);
    if (String(currentScene.version) !== ifMatch) {
      throw new PreconditionFailedException('Version mismatch - scene has been modified by another user');
    }

    // Perform atomic update with optimistic locking
    // The service handles all error scenarios including concurrent updates
    return await this.scenesService.update(id, dto.contentMd, dto.order);
  }

  @TypedRoute.Get(':id')
  async get(@TypedParam('id') id: string) {
    return this.scenesService.getSceneById(id);
  }
}
