import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters';

export async function buildApp() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const configService = app.get(ConfigService);

  // Register CORS
  await app.register(require('@fastify/cors'), {
    origin: configService.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Register security headers with helmet
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  // Typia and @nestia/core handle validation at compile time - no runtime pipe needed
  await app.init();
  return app;
}

async function bootstrap() {
  const app = await buildApp();
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3001);
  
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap();
}
