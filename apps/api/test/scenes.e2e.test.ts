import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src';

let app: ReturnType<typeof buildApp>;

describe('scenes routes', () => {
  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires X-Idempotency-Key on POST', async () => {
    const res = await request(app.server).post('/scenes').send({ text: 'hello' });
    expect(res.status).toBe(400);
  });

  it('detects duplicate X-Idempotency-Key', async () => {
    const res1 = await request(app.server).post('/scenes').set('X-Idempotency-Key', 'dup').send({ text: 'a' });
    expect(res1.status).toBe(201);
    const res2 = await request(app.server).post('/scenes').set('X-Idempotency-Key', 'dup').send({ text: 'b' });
    expect(res2.status).toBe(409);
  });

  it('requires If-Match on PATCH', async () => {
    const create = await request(app.server).post('/scenes').set('X-Idempotency-Key', 'patch1').send({ text: 'initial' });
    const id = create.body.id;
    const res = await request(app.server).patch(`/scenes/${id}`).send({ text: 'change' });
    expect(res.status).toBe(400);
  });

  it('rejects mismatched If-Match', async () => {
    const create = await request(app.server).post('/scenes').set('X-Idempotency-Key', 'patch2').send({ text: 'initial' });
    const id = create.body.id;
    const res = await request(app.server).patch(`/scenes/${id}`).set('If-Match', '999').send({ text: 'change' });
    expect(res.status).toBe(412);
  });

  it('accepts correct If-Match', async () => {
    const create = await request(app.server).post('/scenes').set('X-Idempotency-Key', 'patch3').send({ text: 'initial' });
    const id = create.body.id;
    const version = create.body.version;
    const res = await request(app.server).patch(`/scenes/${id}`).set('If-Match', String(version)).send({ text: 'change' });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(version + 1);
  });
});
