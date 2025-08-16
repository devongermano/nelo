# Ticket: 00-structural/000 - Complete Typia Setup

## Priority
**Critical** - Must be completed before any other ticket. This replaces ALL validation in the project.

## Spec Reference
This is a technical improvement not directly referenced in spec but enables better implementation of all validation requirements throughout the spec.

## Dependencies
None - This is the absolute first ticket to implement

## Current State
- ✅ Typia and @nestia/core installed and working in `/apps/api/`
- ✅ TypeScript transformers properly configured
- ✅ ts-patch installed with prepare script
- ✅ DTOs using Typia interfaces in `/apps/api/src/scenes/dto/`
- ✅ Environment validation using Typia
- ✅ Controllers using @nestia/core decorators
- ✅ SDK package scaffolded at `/packages/sdk/`
- ⚠️ SDK src directory empty (needs generation)
- ⚠️ reflect-metadata may still be imported (needs check)
- ⚠️ class-validator/class-transformer dependencies may still be present

## Target State
- ALL validation uses Typia exclusively
- No runtime validation libraries
- Pure TypeScript interfaces with compile-time validation
- @nestia/core integration for NestJS
- Auto-generated SDK for frontend
- 3-1000x faster validation

## Acceptance Criteria
- [x] Typia and @nestia/core installed and configured
- [x] TypeScript transformer working
- [ ] All class-validator/zod dependencies removed (need to verify)
- [ ] reflect-metadata removed from main.ts (need to verify)
- [x] Validation working with pure interfaces
- [x] SDK generation configured
- [ ] SDK successfully generated
- [ ] All tests passing with new validation
- [ ] Performance benchmarks added

## Implementation Steps

### 1. Install Typia Dependencies

Update root `package.json`:
```json
{
  "devDependencies": {
    "ts-patch": "^3.0.0"
  }
}
```

Update `/apps/api/package.json`:
```json
{
  "dependencies": {
    "@nestia/core": "^3.0.0",
    "typia": "^6.0.0"
  },
  "devDependencies": {
    "@nestia/sdk": "^3.0.0",
    "@nestia/e2e": "^0.6.0"
  }
}
```

Remove these dependencies:
- class-validator
- class-transformer
- Remove reflect-metadata

Update `/packages/shared-types/package.json`:
```json
{
  "dependencies": {
    "typia": "^6.0.0"
  }
}
```

Update `/packages/context/package.json`:
```json
{
  "dependencies": {
    "typia": "^6.0.0"
  }
}
```
Remove zod dependency.

### 2. Configure TypeScript Transformer

Update root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "plugins": [
      {
        "transform": "typia/lib/transform"
      }
    ]
  }
}
```

Update `/apps/api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "typia/lib/transform"
      },
      {
        "transform": "@nestia/core/lib/transform"
      }
    ]
  }
}
```

### 3. Set up ts-patch

Add to root `package.json` scripts:
```json
{
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
```

### 4. Create Typia Validation Utilities

Create `/packages/shared-types/src/validation.ts`:
```typescript
import typia, { tags } from "typia";

// Re-export tags for use in interfaces
export { tags } from "typia";

// Create validation factory
export function createValidators<T>() {
  return {
    validate: typia.createValidate<T>(),
    assert: typia.createAssert<T>(),
    is: typia.createIs<T>(),
    equals: typia.createEquals<T>(),
    random: typia.createRandom<T>()
  };
}

// Export common type tags
export type UUID = string & tags.Format<"uuid">;
export type Email = string & tags.Format<"email">;
export type URL = string & tags.Format<"url">;
export type DateTime = string & tags.Format<"date-time">;
export type PositiveInt = number & tags.Type<"uint32">;
```

### 5. Update main.ts

Update `/apps/api/src/main.ts`:
```typescript
// Remove this line:
// import 'reflect-metadata';

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

  // Remove ValidationPipe - Typia handles validation at compile time
  // No global pipes needed for validation!
  
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
```

### 6. Convert Environment Validation

Update `/apps/api/src/config/environment.validation.ts`:
```typescript
import typia, { tags } from "typia";

export interface EnvironmentVariables {
  NODE_ENV?: ("development" | "production" | "test") & tags.Default<"development">;
  PORT?: number & tags.Type<"uint32"> & tags.Minimum<1> & tags.Maximum<65535> & tags.Default<3001>;
  DATABASE_URL?: string & tags.Default<"postgresql://localhost:5432/nelo">;
  REDIS_URL?: string & tags.Default<"redis://localhost:6379">;
  CORS_ORIGINS?: string & tags.Default<"http://localhost:3000">;
}

export const validate = typia.createAssert<EnvironmentVariables>();

export function validateConfig(config: Record<string, unknown>): EnvironmentVariables {
  // Apply defaults and validate
  const validated = validate(config);
  return validated;
}
```

### 7. Create Nestia Configuration

Create `/apps/api/nestia.config.ts`:
```typescript
import { INestiaConfig } from "@nestia/sdk";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AppModule } from "./src/app.module";

const NESTIA_CONFIG: INestiaConfig = {
  input: async () => {
    const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
      logger: false
    });
    return app;
  },
  output: "../../packages/api-sdk/src",
  distribute: "../../packages/api-sdk",
  primitive: false,
  simulate: true,
  e2e: "./test/e2e"
};
export default NESTIA_CONFIG;
```

### 8. ~~Create API SDK Package~~ ✅ ALREADY DONE

Package exists at `/packages/sdk/` with correct dependencies.
Need to generate the SDK by running:
```bash
cd apps/api
npx @nestia/sdk
```

### 9. Update Controller Pattern

Example update for controllers to use @nestia/core:
```typescript
import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";

@Controller("example")
export class ExampleController {
  /**
   * @summary Example endpoint
   * @tag Example
   */
  @TypedRoute.Post()
  async create(
    @TypedBody() body: CreateExampleDto
  ): Promise<ExampleResponse> {
    // Validation happens at compile time!
    return this.service.create(body);
  }
}
```

## Testing Requirements

1. **Validation Tests**:
   - Create test file to verify Typia validation works
   - Test that invalid data is rejected
   - Test that valid data passes through

2. **Performance Test**:
   - Benchmark validation speed vs old system
   - Should see 3-1000x improvement

3. **SDK Generation Test**:
   ```bash
   cd apps/api
   npx @nestia/sdk
   ```
   - Verify SDK is generated in `/packages/api-sdk/`

4. **E2E Tests**:
   - All existing tests should still pass
   - No runtime errors from missing validators

## Files to Modify/Create

### Create:
- `/packages/shared-types/src/validation.ts` ❌ (shared-types package doesn't exist yet)
- ~~`/apps/api/nestia.config.ts`~~ ✅ EXISTS
- ~~`/packages/sdk/package.json`~~ ✅ EXISTS

### Update:
- `/apps/api/src/main.ts` - Remove reflect-metadata and ValidationPipe
- `/apps/api/src/config/environment.validation.ts` - Convert to interface
- `/apps/api/package.json` - Update dependencies
- `/packages/shared-types/package.json` - Add typia
- `/packages/context/package.json` - Replace zod with typia
- Root `tsconfig.json` - Add transformer
- `/apps/api/tsconfig.json` - Add transformers

### Delete:
- Remove all class-validator imports
- Remove all class-transformer imports
- Remove all zod imports
- Remove reflect-metadata imports

## Validation Commands

```bash
# Verify ts-patch is working
pnpm prepare

# Test TypeScript compilation with transformer
cd apps/api
pnpm typecheck

# Generate SDK to test Nestia integration
cd apps/api
npx @nestia/sdk

# Verify SDK was generated
ls ../../packages/sdk/src/

# Run tests to ensure validation works
pnpm test

# Start dev server to test runtime
pnpm dev
```

## Notes

- This is a breaking change - ALL validation code changes
- Typia validation happens at COMPILE TIME, not runtime
- Much faster performance (3-1000x improvement)
- Smaller bundle size (no validation libraries in bundle)
- Better type safety (validation matches TypeScript types exactly)
- After this ticket, ALL other tickets should use Typia interfaces

## Migration Checklist

- [ ] Remove class-validator from all package.json files (if present)
- [ ] Remove class-transformer from all package.json files (if present)
- [ ] Remove zod from all package.json files (already removed from context)
- [ ] Remove reflect-metadata import from main.ts (needs verification)
- [x] Add typia to necessary packages
- [x] Add @nestia/core to API
- [x] Configure TypeScript transformers
- [x] Set up ts-patch
- [x] Convert DTOs to interfaces (done for scenes)
- [x] Update controllers to use @nestia/core decorators
- [ ] Generate SDK successfully
- [ ] All tests pass