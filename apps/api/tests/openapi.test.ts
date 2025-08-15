import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupOpenAPI } from '../openapi';

let app: INestApplication;

describe('OpenAPI', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await setupOpenAPI(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves openapi json with health path', async () => {
    const res = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    expect(res.body.paths['/health']).toBeDefined();
  });
});
