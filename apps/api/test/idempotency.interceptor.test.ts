import { Test } from '@nestjs/testing';
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IdempotencyInterceptor, IDEMPOTENCY_REDIS } from '../src/interceptors/idempotency.interceptor';
import RedisMock from 'ioredis-mock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

@Controller()
@UseInterceptors(IdempotencyInterceptor)
class TestController {
  @Post('test')
  handler() {
    return { ok: true };
  }
}

describe('IdempotencyInterceptor', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        IdempotencyInterceptor,
        { provide: IDEMPOTENCY_REDIS, useValue: new RedisMock() },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 409 on duplicate idempotency key', async () => {
    await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
    const res = await app.inject({ method: 'POST', url: '/test', headers: { 'x-idempotency-key': 'abc' } });
    expect(res.statusCode).toBe(409);
  });
});
