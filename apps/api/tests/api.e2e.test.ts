import { describe, it, beforeEach, expect } from 'vitest';
import Fastify from 'fastify';
import request from 'supertest';
import { prisma, reset } from '@nelo/db';
import projectsController from '../src/projects.controller';
import scenesController from '../src/scenes.controller';

beforeEach(async () => {
  await reset();
});

describe('API e2e', () => {
  it('GET /projects', async () => {
    await prisma.project.create({ data: { name: 'proj', version: 1 } });
    const app = Fastify();
    app.register(projectsController);
    await app.ready();
    const res = await request(app.server).get('/projects');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    await app.close();
  });

  it('GET /scenes/:id', async () => {
    const project = await prisma.project.create({ data: { name: 'p', version: 1 } });
    const book = await prisma.book.create({ data: { title: 'b', projectId: project.id } });
    const chapter = await prisma.chapter.create({ data: { title: 'c', bookId: book.id } });
    const scene = await prisma.scene.create({ data: { chapterId: chapter.id, content: 'hi' } });

    const app = Fastify();
    app.register(scenesController);
    await app.ready();

    const res = await request(app.server).get(`/scenes/${scene.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(scene.id);

    const missing = await request(app.server).get('/scenes/nonexistent');
    expect(missing.status).toBe(404);

    await app.close();
  });
});
