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

### 3. Create Prisma Client Extension

Create `/packages/db/src/client.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

// Create extended client with soft delete functionality
export const createPrismaClient = () => {
  const prisma = new PrismaClient();

  return prisma.$extends({
    name: 'soft-delete',
    
    // Add soft delete methods to all models
    model: {
      $allModels: {
        async softDelete<T>(
          this: T,
          args: any & { where: { id: string } },
          userId: string
        ) {
          const context = this as any;
          return context.update({
            ...args,
            data: {
              deletedAt: new Date(),
              deletedBy: userId,
            },
          });
        },

        async restore<T>(
          this: T,
          args: any & { where: { id: string } }
        ) {
          const context = this as any;
          return context.update({
            ...args,
            data: {
              deletedAt: null,
              deletedBy: null,
            },
          });
        },

        async findManyWithDeleted<T>(this: T, args?: any) {
          return (this as any).findMany(args);
        },

        async findFirstWithDeleted<T>(this: T, args?: any) {
          return (this as any).findFirst(args);
        },
      },
    },

    // Override query methods to exclude soft-deleted records by default
    query: {
      $allModels: {
        async findMany({ args, query }) {
          // Automatically filter out soft-deleted records
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },

        async findFirst({ args, query }) {
          // Automatically filter out soft-deleted records
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },

        async findUnique({ args, query }) {
          // For findUnique, we need to check after fetching
          const result = await query(args);
          if (result && (result as any).deletedAt) {
            return null;
          }
          return result;
        },

        async count({ args, query }) {
          // Automatically filter out soft-deleted records from count
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        },

        async create({ args, query, model }) {
          // Auto-populate audit fields on create
          const userId = (args as any).userId;
          if (userId) {
            args.data = {
              ...args.data,
              createdBy: userId,
              updatedBy: userId,
            };
            delete (args as any).userId;
          }
          return query(args);
        },

        async update({ args, query }) {
          // Auto-populate updatedBy on update
          const userId = (args as any).userId;
          if (userId) {
            args.data = {
              ...args.data,
              updatedBy: userId,
            };
            delete (args as any).userId;
          }
          return query(args);
        },
      },
    },
  });
};

// Export the extended client type
export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
```

Update `/packages/db/src/index.ts`:
```typescript
export * from '@prisma/client';
export { createPrismaClient, type ExtendedPrismaClient } from './client';
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

### 5. Update Services to Use Extended Client

Example for ScenesService:
```typescript
import { Injectable } from '@nestjs/common';
import { ExtendedPrismaClient } from '@nelo/db';

@Injectable()
export class ScenesService {
  constructor(private prisma: ExtendedPrismaClient) {}

  async create(contentMd: string, chapterId: string, projectId: string, userId: string) {
    // The extended client automatically handles audit fields
    return this.prisma.scene.create({
      data: {
        contentMd,
        chapterId,
        projectId,
      },
      userId, // Pass userId for automatic audit field population
    } as any);
  }

  async findAll(projectId: string) {
    // Automatically excludes soft-deleted records
    return this.prisma.scene.findMany({
      where: { projectId }
    });
  }

  async findAllIncludingDeleted(projectId: string) {
    // Use special method to include deleted records
    return this.prisma.scene.findManyWithDeleted({
      where: { projectId }
    });
  }

  async softDelete(id: string, userId: string) {
    // Use the extended soft delete method
    return this.prisma.scene.softDelete(
      { where: { id } },
      userId
    );
  }

  async restore(id: string) {
    // Use the extended restore method
    return this.prisma.scene.restore({
      where: { id }
    });
  }

  async update(id: string, data: any, userId: string) {
    // The extended client automatically updates the updatedBy field
    return this.prisma.scene.update({
      where: { id },
      data,
      userId, // Pass userId for automatic audit field population
    } as any);
  }
}
```

### 5a. Register Extended Client as Provider

Update `/apps/api/src/app.module.ts`:
```typescript
import { createPrismaClient, ExtendedPrismaClient } from '@nelo/db';

@Module({
  // ... existing configuration
  providers: [
    {
      provide: ExtendedPrismaClient,
      useFactory: () => createPrismaClient(),
    },
    // ... other providers
  ],
  exports: [ExtendedPrismaClient],
})
export class AppModule {}
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
- Test findManyWithDeleted returns all records
- Test restoration clears deletion fields
- Test audit fields are populated correctly

### Integration Tests
```typescript
describe('Soft Delete with Prisma Extensions', () => {
  let prisma: ExtendedPrismaClient;
  
  beforeEach(() => {
    prisma = createPrismaClient();
  });

  it('should soft delete a scene', async () => {
    const scene = await prisma.scene.create({
      data: { contentMd: 'Test', chapterId: '...', projectId: '...' },
      userId: 'user123',
    } as any);
    
    await prisma.scene.softDelete({ where: { id: scene.id } }, 'user123');
    
    // Default query should not find it
    const scenes = await prisma.scene.findMany();
    expect(scenes).not.toContainEqual(expect.objectContaining({ id: scene.id }));
    
    // Special method should find it
    const allScenes = await prisma.scene.findManyWithDeleted();
    expect(allScenes).toContainEqual(expect.objectContaining({ 
      id: scene.id,
      deletedAt: expect.any(Date),
      deletedBy: 'user123'
    }));
  });
  
  it('should restore a soft-deleted scene', async () => {
    const scene = await prisma.scene.create({
      data: { contentMd: 'Test', chapterId: '...', projectId: '...' }
    });
    
    await prisma.scene.softDelete({ where: { id: scene.id } }, 'user123');
    await prisma.scene.restore({ where: { id: scene.id } });
    
    const scenes = await prisma.scene.findMany();
    expect(scenes).toContainEqual(expect.objectContaining({ 
      id: scene.id,
      deletedAt: null
    }));
  });

  it('should automatically populate audit fields', async () => {
    const scene = await prisma.scene.create({
      data: { contentMd: 'Test', chapterId: '...', projectId: '...' },
      userId: 'user123',
    } as any);
    
    expect(scene.createdBy).toBe('user123');
    expect(scene.updatedBy).toBe('user123');
    
    const updated = await prisma.scene.update({
      where: { id: scene.id },
      data: { contentMd: 'Updated' },
      userId: 'user456',
    } as any);
    
    expect(updated.createdBy).toBe('user123');
    expect(updated.updatedBy).toBe('user456');
  });
});
```

## Files to Modify/Create
- `/packages/db/prisma/schema.prisma` - Add audit and soft delete fields
- `/packages/db/src/client.ts` - Create Prisma client extension
- `/packages/db/src/index.ts` - Export extended client
- `/apps/api/src/app.module.ts` - Register extended client provider
- `/apps/api/src/middlewares/audit.middleware.ts` - Audit middleware
- `/apps/api/src/scenes/scenes.service.ts` - Use extended client
- `/apps/api/src/scenes/scenes.controller.ts` - Add restore endpoint
- `/packages/db/tests/soft-delete.test.ts` - Test extensions

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
- **2024 Best Practice**: Using Prisma Client Extensions ($extends) instead of deprecated middleware
- Extensions provide type safety and better performance than middleware approach
- Middleware ($use) was deprecated in Prisma v5.2.2 in favor of extensions
- Phase 1: Core content models only
- Phase 2: Extend to all user-generated content
- Consider archive strategy for old soft-deleted records
- Monitor storage impact of keeping deleted records
- Future: Add "purge" endpoint for permanent deletion (OWNER only)