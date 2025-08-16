import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@nelo/db';

export interface Scene {
  id: string;
  text: string;
  version: number;
}

@Injectable()
export class ScenesService {
  private scenes = new Map<string, Scene>();
  private nextId = 1;

  create(text: string): Scene {
    const id = String(this.nextId++);
    const scene: Scene = { id, text, version: 1 };
    this.scenes.set(id, scene);
    return scene;
  }

  find(id: string): Scene {
    const scene = this.scenes.get(String(id));
    if (!scene) {
      throw new NotFoundException('Scene not found');
    }
    return scene;
  }

  update(id: string, text?: string): Scene {
    const scene = this.find(id);
    if (typeof text === 'string') {
      scene.text = text;
    }
    scene.version += 1;
    return scene;
  }

  async getSceneById(id: string) {
    const scene = await prisma.scene.findUnique({ where: { id } });
    if (!scene) {
      throw new NotFoundException('Scene not found');
    }
    return scene;
  }
}
