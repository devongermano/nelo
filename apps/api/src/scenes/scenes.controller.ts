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
  create(@Body() dto: CreateSceneDto) {
    return this.scenesService.create(dto.text);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @IfMatchHeader() ifMatch: string,
    @Body() dto: UpdateSceneDto,
  ) {
    const scene = this.scenesService.find(id);
    if (String(scene.version) !== ifMatch) {
      throw new PreconditionFailedException('Version mismatch');
    }
    return this.scenesService.update(id, dto.text);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.scenesService.getSceneById(id);
  }
}
