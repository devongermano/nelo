# Ticket: 00-structural/006 - Audit & Soft Delete Infrastructure

## Priority
**Medium** - Important for production but not blocking core features

## Spec Reference
- Spec Evolution #007 (Soft Delete Pattern)
- Spec Evolution #008 (Audit Fields Pattern)

## Dependencies
- 00-structural/001 (Database Schema Update) - Complete ✅

## Current State
- Only Refactor model has `createdBy` field
- No soft delete functionality
- Hard deletes with CASCADE everywhere
- No audit trail for content changes

## Target State
- Systematic audit fields (createdBy, updatedBy) on content models
- Soft delete fields (deletedAt, deletedBy) on core models
- Default queries exclude soft-deleted records
- Restoration capability for deleted content
- Complete audit trail for compliance

## Acceptance Criteria
- [ ] Audit fields added to target models
- [ ] Soft delete fields added to target models
- [ ] Migration created and applied successfully
- [ ] Default queries exclude soft-deleted records
- [ ] `includeDeleted` parameter works on relevant endpoints
- [ ] Restoration endpoint for OWNER/MAINTAINER roles
- [ ] Tests cover soft delete and restoration flows
- [ ] Audit fields populated from JWT claims

## Implementation Steps

### 1. Update Prisma Schema

Add to these models: Project, Book, Chapter, Scene, Entity, CanonFact

```prisma
// Audit fields
createdBy String?
updatedBy String?

// Soft delete fields  
deletedAt DateTime?
deletedBy String?

// Add indexes for performance
@@index([deletedAt])
@@index([createdBy])
```

### 2. Create Migration

```bash
cd packages/db
pnpm prisma migrate dev --name add_audit_soft_delete
```

### 3. Update Database Package

Create `/packages/db/src/soft-delete.ts`:
```typescript
import { Prisma } from '@prisma/client';

export function excludeDeleted<T extends { deletedAt?: Date | null }>(
  query: Prisma.Args<T, 'findMany'>
): Prisma.Args<T, 'findMany'> {
  return {
    ...query,
    where: {
      ...query.where,
      deletedAt: null
    }
  };
}

export function includeDeleted<T>(query: Prisma.Args<T, 'findMany'>): Prisma.Args<T, 'findMany'> {
  // Returns query as-is, including soft-deleted records
  return query;
}

export async function softDelete(
  model: any,
  id: string, 
  userId: string
): Promise<void> {
  await model.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy: userId
    }
  });
}

export async function restore(
  model: any,
  id: string
): Promise<void> {
  await model.update({
    where: { id },
    data: {
      deletedAt: null,
      deletedBy: null
    }
  });
}
```

### 4. Create Audit Middleware

Create `/apps/api/src/middlewares/audit.middleware.ts`:
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    // Attach audit info to request for services to use
    if (req.user) {
      req.auditInfo = {
        userId: req.user.sub,
        timestamp: new Date()
      };
    }
    next();
  }
}
```

### 5. Update Services

Example for ScenesService:
```typescript
async create(contentMd: string, chapterId: string, projectId: string, auditInfo?: AuditInfo) {
  return this.prisma.scene.create({
    data: {
      contentMd,
      chapterId,
      projectId,
      createdBy: auditInfo?.userId,
      updatedBy: auditInfo?.userId,
      // ... other fields
    }
  });
}

async findAll(projectId: string, includeDeleted = false) {
  const query = {
    where: { 
      projectId,
      ...(includeDeleted ? {} : { deletedAt: null })
    }
  };
  return this.prisma.scene.findMany(query);
}

async softDelete(id: string, userId: string) {
  return softDelete(this.prisma.scene, id, userId);
}

async restore(id: string) {
  // Check permissions first
  return restore(this.prisma.scene, id);
}
```

### 6. Add Restoration Endpoint

In `ScenesController`:
```typescript
@TypedRoute.Post(':id/restore')
@UseGuards(new PolicyGuard('scene.restore'))
async restore(@TypedParam('id') id: string) {
  return this.scenesService.restore(id);
}
```

## Testing Requirements

### Unit Tests
- Test soft delete marks record as deleted
- Test default queries exclude deleted records
- Test includeDeleted parameter returns all records
- Test restoration clears deletion fields
- Test audit fields are populated correctly

### Integration Tests
```typescript
describe('Soft Delete', () => {
  it('should soft delete a scene', async () => {
    const scene = await createScene();
    await softDelete(scene.id, userId);
    
    const scenes = await findAllScenes();
    expect(scenes).not.toContainEqual(expect.objectContaining({ id: scene.id }));
    
    const allScenes = await findAllScenes({ includeDeleted: true });
    expect(allScenes).toContainEqual(expect.objectContaining({ 
      id: scene.id,
      deletedAt: expect.any(Date),
      deletedBy: userId
    }));
  });
  
  it('should restore a soft-deleted scene', async () => {
    const scene = await createScene();
    await softDelete(scene.id, userId);
    await restore(scene.id);
    
    const scenes = await findAllScenes();
    expect(scenes).toContainEqual(expect.objectContaining({ 
      id: scene.id,
      deletedAt: null
    }));
  });
});
```

## Files to Modify/Create
- `/packages/db/prisma/schema.prisma` - Add fields
- `/packages/db/src/soft-delete.ts` - New utilities
- `/packages/db/src/index.ts` - Export utilities
- `/apps/api/src/middlewares/audit.middleware.ts` - New middleware
- `/apps/api/src/scenes/scenes.service.ts` - Update queries
- `/apps/api/src/scenes/scenes.controller.ts` - Add restore endpoint
- `/packages/db/tests/soft-delete.test.ts` - New tests

## Validation Commands
```bash
# Run migration
cd packages/db
pnpm prisma migrate dev

# Run tests
pnpm test soft-delete

# Check types
pnpm typecheck

# Test restoration endpoint
curl -X POST http://localhost:3001/scenes/{id}/restore \
  -H "Authorization: Bearer $TOKEN"
```

## Notes
- Phase 1: Core content models only
- Phase 2: Extend to all user-generated content
- Consider archive strategy for old soft-deleted records
- Monitor storage impact of keeping deleted records
- Future: Add "purge" endpoint for permanent deletion (OWNER only)