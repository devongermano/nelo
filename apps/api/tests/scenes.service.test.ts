import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, reset } from '@nelo/db';
import { getSceneById } from '../src/scenes.service';

beforeEach(async () => {
  await reset();
});

describe('scenes.service', () => {
  it('returns scene by id', async () => {
    const project = await prisma.project.create({ data: { name: 'p', version: 1 } });
    const book = await prisma.book.create({ data: { title: 'b', projectId: project.id } });
    const chapter = await prisma.chapter.create({ data: { title: 'c', bookId: book.id } });
    const scene = await prisma.scene.create({ data: { chapterId: chapter.id, content: 'hi' } });
    const found = await getSceneById(scene.id);
    expect(found?.id).toBe(scene.id);
  });

  it('returns null when scene missing', async () => {
    const result = await getSceneById('nonexistent');
    expect(result).toBeNull();
  });
});
