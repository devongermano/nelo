import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

export async function buildApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

async function bootstrap() {
  const app = await buildApp();
  await app.listen(3001);
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  bootstrap();
}
