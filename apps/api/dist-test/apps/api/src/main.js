"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const app_module_1 = require("./app.module");
const filters_1 = require("./filters");
async function buildApp() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    const configService = app.get(config_1.ConfigService);
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
    app.useGlobalFilters(new filters_1.GlobalExceptionFilter(configService));
    // Typia and @nestia/core handle validation at compile time - no runtime pipe needed
    await app.init();
    return app;
}
async function bootstrap() {
    const app = await buildApp();
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT', 3001);
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://localhost:${port}`);
}
if (require.main === module) {
    bootstrap();
}
//# sourceMappingURL=main.js.map