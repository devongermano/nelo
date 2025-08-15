// @ts-ignore
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import Fastify from 'fastify';
import contextController from '../src/context/context.controller';

describe('POST /compose-context', () => {
  it('returns empty segments and redactions', async () => {
    const app = Fastify();
    app.register(contextController);
    await app.ready();
    const response = await request(app.server)
      .post('/compose-context')
      .send({});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ segments: [], redactions: [] });
    await app.close();
  });
});
