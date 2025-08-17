import { describe, it, beforeEach, expect } from 'vitest';
import request from 'supertest';
import { prisma, reset, SceneStatus } from '@nelo/db';
import { buildApp } from '../src/main';

beforeEach(async () => {
  await reset();
});

describe('API e2e', () => {
  it('GET /projects', async () => {
    await prisma.project.create({ data: { name: 'proj', slug: 'proj-slug', version: 1 } });
    const app = await buildApp();
    const res = await request(app.getHttpServer()).get('/projects');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    await app.close();
  }, 10000);

  it('GET /scenes/:id', async () => {
    const project = await prisma.project.create({ data: { name: 'p', slug: 'p-slug', version: 1 } });
    const book = await prisma.book.create({ data: { title: 'b', projectId: project.id, index: 0 } });
    const chapter = await prisma.chapter.create({ data: { title: 'c', bookId: book.id, index: 0 } });
    const scene = await prisma.scene.create({ data: { 
      chapterId: chapter.id, 
      projectId: project.id, 
      contentMd: 'hi',
      index: 0,
      status: SceneStatus.DRAFT,
      docCrdt: {},
      wordCount: 1
    } });

    const app = await buildApp();

    const res = await request(app.getHttpServer()).get(`/scenes/${scene.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(scene.id);

    const missing = await request(app.getHttpServer()).get('/scenes/nonexistent');
    expect(missing.status).toBe(404);

    await app.close();
  }, 10000);
});
