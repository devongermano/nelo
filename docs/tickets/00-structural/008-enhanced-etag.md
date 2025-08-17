# Ticket: 00-structural/008 - Enhanced ETag Implementation

## Priority
**Low** - Improvement to existing optimistic locking

## Spec Reference
- Spec Evolution #004 (Optimistic Locking via Version Fields) - Implemented ✅
- Spec Evolution #010 (Enhanced ETag Format for Optimistic Locking)

## Dependencies
- 00-structural/001 (Database Schema Update) - Complete ✅

## Current State
- Version fields exist on models
- Simple string comparison in scenes controller
- If-Match header decorator exists
- Not using standard ETag format

## Target State
- Standard ETag format: `W/"resource-id-v{version}"`
- ETag generation utilities
- ETag parsing and validation
- Proper 412 Precondition Failed responses
- Support for multiple resource types

## Acceptance Criteria
- [ ] ETag generator function created
- [ ] ETag parser function created
- [ ] Scenes controller uses ETag format
- [ ] If-Match header properly parsed
- [ ] Returns 412 on version mismatch
- [ ] ETag included in response headers
- [ ] Tests cover ETag validation
- [ ] Works with CDN/proxy caches

## Implementation Steps

### 1. Create ETag Utilities

Create `/apps/api/src/common/etag.utils.ts`:
```typescript
export function generateETag(
  resourceType: string,
  id: string,
  version: number
): string {
  return `W/"${resourceType}-${id}-v${version}"`;
}

export function parseETag(etag: string): {
  weak: boolean;
  resourceType: string;
  id: string;
  version: number;
} | null {
  // Handle both weak (W/) and strong ETags
  const match = /^(W\/)?"(\w+)-(.+)-v(\d+)"$/.exec(etag);
  if (!match) return null;
  
  return {
    weak: !!match[1],
    resourceType: match[2],
    id: match[3],
    version: parseInt(match[4], 10)
  };
}

export function validateETag(
  etag: string,
  expectedType: string,
  expectedId: string,
  currentVersion: number
): boolean {
  const parsed = parseETag(etag);
  if (!parsed) return false;
  
  return (
    parsed.resourceType === expectedType &&
    parsed.id === expectedId &&
    parsed.version === currentVersion
  );
}
```

### 2. Create ETag Interceptor

Create `/apps/api/src/interceptors/etag.interceptor.ts`:
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { generateETag } from '../common/etag.utils';

@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        const response = context.switchToHttp().getResponse();
        
        // If response has version field, generate ETag
        if (data && typeof data === 'object' && 'version' in data && 'id' in data) {
          const resourceType = this.getResourceType(context);
          const etag = generateETag(resourceType, data.id, data.version);
          response.header('ETag', etag);
        }
        
        return data;
      })
    );
  }
  
  private getResourceType(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const path = request.route?.path || request.url;
    
    // Extract resource type from path (e.g., /scenes/:id → 'scene')
    const match = /\/(\w+)/.exec(path);
    return match?.[1]?.replace(/s$/, '') || 'resource'; // Remove plural 's'
  }
}
```

### 3. Update Scenes Controller

Update `/apps/api/src/scenes/scenes.controller.ts`:
```typescript
import { UseInterceptors } from '@nestjs/common';
import { ETagInterceptor } from '../interceptors/etag.interceptor';
import { parseETag, validateETag } from '../common/etag.utils';

@Controller('scenes')
@UseInterceptors(ETagInterceptor) // Add ETag to responses
export class ScenesController {
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @IfMatchHeader() ifMatch: string,
    @Body() dto: UpdateSceneDto,
  ) {
    // Parse ETag
    const etagData = parseETag(ifMatch);
    if (!etagData) {
      throw new BadRequestException('Invalid ETag format');
    }
    
    // Verify resource type and ID
    if (etagData.resourceType !== 'scene' || etagData.id !== id) {
      throw new BadRequestException('ETag resource mismatch');
    }
    
    // Get current scene to check version
    const currentScene = await this.scenesService.find(id);
    
    // Validate version matches
    if (currentScene.version !== etagData.version) {
      throw new PreconditionFailedException(
        'Resource has been modified. Current version: ' + currentScene.version
      );
    }
    
    // Perform update with optimistic locking
    return await this.scenesService.update(id, dto.contentMd, dto.order);
  }
  
  @Get(':id')
  async get(@Param('id') id: string) {
    const scene = await this.scenesService.getSceneById(id);
    // ETagInterceptor will automatically add ETag header
    return scene;
  }
}
```

### 4. Update If-Match Decorator

Enhance `/apps/api/src/common/if-match-header.decorator.ts`:
```typescript
import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IfMatchHeader = createParamDecorator(
  (options: { required?: boolean } = { required: true }, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers['if-match'];
    
    if (options.required && (!value || typeof value !== 'string')) {
      throw new BadRequestException('If-Match header required for this operation');
    }
    
    // Normalize ETag (remove quotes if present)
    if (value && typeof value === 'string') {
      return value.trim();
    }
    
    return undefined;
  },
);
```

## Testing Requirements

### Unit Tests
```typescript
describe('ETag Utils', () => {
  describe('generateETag', () => {
    it('should generate weak ETag in correct format', () => {
      const etag = generateETag('scene', 'uuid-123', 5);
      expect(etag).toBe('W/"scene-uuid-123-v5"');
    });
  });
  
  describe('parseETag', () => {
    it('should parse valid weak ETag', () => {
      const result = parseETag('W/"scene-uuid-123-v5"');
      expect(result).toEqual({
        weak: true,
        resourceType: 'scene',
        id: 'uuid-123',
        version: 5
      });
    });
    
    it('should return null for invalid format', () => {
      expect(parseETag('invalid')).toBeNull();
      expect(parseETag('"missing-version"')).toBeNull();
    });
  });
});
```

### Integration Tests
```typescript
describe('ETag Integration', () => {
  it('should return 412 when ETag version mismatches', async () => {
    const scene = await createScene();
    
    // Update once to increment version
    await updateScene(scene.id, { contentMd: 'Updated' });
    
    // Try to update with old ETag
    const oldETag = `W/"scene-${scene.id}-v1"`;
    const response = await request(app)
      .patch(`/scenes/${scene.id}`)
      .set('If-Match', oldETag)
      .send({ contentMd: 'Should fail' });
    
    expect(response.status).toBe(412);
    expect(response.body.message).toContain('Resource has been modified');
  });
  
  it('should include ETag in response headers', async () => {
    const scene = await createScene();
    
    const response = await request(app)
      .get(`/scenes/${scene.id}`);
    
    expect(response.headers.etag).toBe(`W/"scene-${scene.id}-v1"`);
  });
});
```

## Files to Modify/Create
- `/apps/api/src/common/etag.utils.ts` - New utilities
- `/apps/api/src/interceptors/etag.interceptor.ts` - New interceptor
- `/apps/api/src/scenes/scenes.controller.ts` - Update to use ETags
- `/apps/api/src/common/if-match-header.decorator.ts` - Enhance decorator
- `/apps/api/tests/etag.test.ts` - New tests

## Validation Commands
```bash
# Run tests
cd apps/api
pnpm test etag

# Test ETag generation
curl -I http://localhost:3001/scenes/{id}
# Should see: ETag: W/"scene-{id}-v{version}"

# Test optimistic locking
curl -X PATCH http://localhost:3001/scenes/{id} \
  -H "If-Match: W/\"scene-{id}-v1\"" \
  -H "Content-Type: application/json" \
  -d '{"contentMd": "Updated content"}'
```

## Notes
- This is a backward-compatible enhancement
- Weak ETags (W/) indicate semantic equivalence
- Strong ETags would require byte-for-byte equality
- Consider adding If-None-Match support for caching
- Future: Support ETag for other resources (projects, chapters, etc.)