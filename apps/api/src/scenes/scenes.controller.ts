import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
  PreconditionFailedException,
} from '@nestjs/common';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { CreateSceneDto } from './dto/create-scene.dto';
import { UpdateSceneDto } from './dto/update-scene.dto';
import { ScenesService } from './scenes.service';
import { IfMatchHeader } from '../common/if-match-header.decorator';

@Controller('scenes')
export class ScenesController {
  constructor(private readonly scenesService: ScenesService) {}

  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  async create(@Body() dto: CreateSceneDto) {
    const { content, chapterId, projectId } = dto;
    return this.scenesService.create(content, chapterId, projectId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @IfMatchHeader() ifMatch: string,
    @Body() dto: UpdateSceneDto,
  ) {
    // First verify the version matches what the client expects
    const currentScene = await this.scenesService.find(id);
    if (String(currentScene.version) !== ifMatch) {
      throw new PreconditionFailedException('Version mismatch - scene has been modified by another user');
    }

    // Perform atomic update with optimistic locking
    // The service handles all error scenarios including concurrent updates
    return await this.scenesService.update(id, dto.content, dto.order);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.scenesService.getSceneById(id);
  }
}
