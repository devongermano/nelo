import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { CreateSceneDto } from './scenes/dto/create-scene.dto';
import { UpdateSceneDto } from './scenes/dto/update-scene.dto';

interface Scene { id: string; text: string; version: number }
const scenes = new Map<string, Scene>();
let nextId = 1;

@Controller('scenes')
export class ScenesController {
  @Get(':id')
  getScene(@Param('id') id: string) {
    const scene = scenes.get(String(id));
    if (!scene) {
      throw new NotFoundException();
    }
    return scene;
  }

  @Post()
  createScene(@Body() dto: CreateSceneDto) {
    const id = String(nextId++);
    const scene: Scene = { id, text: dto.text, version: 1 };
    scenes.set(id, scene);
    return scene;
  }

  @Patch(':id')
  updateScene(@Param('id') id: string, @Body() dto: UpdateSceneDto) {
    const scene = scenes.get(String(id));
    if (!scene) {
      throw new NotFoundException();
    }
    if (dto.text !== undefined) {
      scene.text = dto.text;
    }
    scene.version += 1;
    return scene;
  }
}

export { scenes };
