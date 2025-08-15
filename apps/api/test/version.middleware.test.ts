import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { versionMiddleware } from '../src/middlewares/version.middleware';

describe('version middleware', () => {
  it('returns 412 when If-Match does not match scene.version', async () => {
    const app = Fastify();
    const scene = { id: '1', text: 'hello', version: 1 };
    app.patch('/scenes/:id', {
      preHandler: [
        (req, _reply, done) => {
          (req as any).scene = scene;
          done();
        },
        versionMiddleware
      ]
    }, async () => ({ ok: true }));

    const res = await app.inject({ method: 'PATCH', url: '/scenes/1', headers: { 'if-match': '2' } });
    expect(res.statusCode).toBe(412);
  });
});
