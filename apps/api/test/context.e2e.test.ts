/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/main';

describe('POST /compose-context', () => {
  it('returns empty segments and redactions', async () => {
    const app = await buildApp();
    const response = await request(app.getHttpServer())
      .post('/compose-context')
      .send({ template: 'hi' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ segments: [], redactions: [] });
    await app.close();
  }, 10000);
});
