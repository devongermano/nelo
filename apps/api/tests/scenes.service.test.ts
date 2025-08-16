import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { prisma, reset } from '@nelo/db';
import { ScenesService } from '../src/scenes/scenes.service';

beforeEach(async () => {
  await reset();
});

describe('scenes.service', () => {
  it('returns scene by id', async () => {
    const project = await prisma.project.create({ data: { name: 'p', version: 1 } });
    const book = await prisma.book.create({ data: { title: 'b', projectId: project.id } });
    const chapter = await prisma.chapter.create({ data: { title: 'c', bookId: book.id } });
    const scene = await prisma.scene.create({ data: { chapterId: chapter.id, projectId: project.id, content: 'hi' } });
    const service = new ScenesService();
    const found = await service.getSceneById(scene.id);
    expect(found?.id).toBe(scene.id);
  });

  it('throws when scene missing', async () => {
    const service = new ScenesService();
    await expect(service.getSceneById('nonexistent')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
