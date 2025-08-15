import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupOpenAPI } from '../openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await setupOpenAPI(app);
  await app.listen(3001);
  console.log(`API listening on http://localhost:3001`);
}
bootstrap();
