import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { idempotencyMiddleware, clearIdempotencyKeys } from '../src/middlewares/idempotency.middleware';

describe('idempotency middleware', () => {
  afterEach(() => {
    clearIdempotencyKeys();
  });

  it('returns 409 on duplicate idempotency key', async () => {
    const app = Fastify();
    app.post('/test', { preHandler: idempotencyMiddleware }, async () => ({ ok: true }));

    await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
    const res = await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
    expect(res.statusCode).toBe(409);
  });
});
