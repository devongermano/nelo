# Ticket: 00-structural/007 - Permission Matrix & Guards

## Priority
**High** - Required for proper access control

## Spec Reference
- `/docs/spec-pack.md` - Role enum (line 275)
- Spec Evolution #012 (Permission Matrix Pattern) - To be added

## Dependencies
- 00-structural/004 (Auth Package Setup) - In progress

## Current State
- Roles defined: OWNER, MAINTAINER, WRITER, READER
- No permission matrix documented
- No systematic permission checking
- No PolicyGuard implementation

## Target State
- Complete permission matrix documented
- PolicyGuard for action-based permissions
- Consistent permission checking across all endpoints
- Clear documentation of who can do what

## Acceptance Criteria
- [ ] Permission matrix documented in `/docs/permissions.md`
- [ ] PolicyGuard implementation with action checking
- [ ] Guards applied to all protected endpoints
- [ ] Permission denied returns 403 Forbidden
- [ ] Tests cover all role/action combinations
- [ ] Admin override capability for OWNER role

## Implementation Steps

### 1. Create Permission Matrix Documentation

Create `/docs/permissions.md`:
```markdown
# Permission Matrix

## Core Permissions

| Action | OWNER | MAINTAINER | WRITER | READER | Notes |
|--------|:-----:|:----------:|:------:|:------:|-------|
| **Project Management** |
| project.create | ✅ | ❌ | ❌ | ❌ | Only owners can create projects |
| project.delete | ✅ | ❌ | ❌ | ❌ | Permanent deletion |
| project.update | ✅ | ✅ | ❌ | ❌ | Settings, metadata |
| project.invite | ✅ | ✅ | ❌ | ❌ | Add team members |
| project.member.remove | ✅ | ✅ | ❌ | ❌ | Remove team members |
| project.member.role | ✅ | ❌ | ❌ | ❌ | Change member roles |
| **Content Management** |
| scene.create | ✅ | ✅ | ✅ | ❌ | Create new scenes |
| scene.update | ✅ | ✅ | ✅ | ❌ | Edit scene content |
| scene.delete | ✅ | ✅ | ✅ | ❌ | Soft delete scenes |
| scene.restore | ✅ | ✅ | ❌ | ❌ | Restore deleted scenes |
| scene.read | ✅ | ✅ | ✅ | ✅ | View scene content |
| **AI Generation** |
| ai.generate | ✅ | ✅ | ✅ | ❌ | Use AI features |
| ai.provider.add | ✅ | ✅ | ❌ | ❌ | Add provider keys |
| ai.provider.delete | ✅ | ❌ | ❌ | ❌ | Remove provider keys |
| ai.budget.set | ✅ | ✅ | ❌ | ❌ | Set spending limits |
| **Refactoring** |
| refactor.create | ✅ | ✅ | ✅ | ❌ | Create refactor request |
| refactor.apply | ✅ | ✅ | ❌ | ❌ | Apply refactor patches |
| refactor.force | ✅ | ❌ | ❌ | ❌ | Force conflicting patches |
| **Codex (Entities)** |
| entity.create | ✅ | ✅ | ✅ | ❌ | Create entities |
| entity.update | ✅ | ✅ | ✅ | ❌ | Edit entities |
| entity.delete | ✅ | ✅ | ❌ | ❌ | Delete entities |
| canon.create | ✅ | ✅ | ✅ | ❌ | Add canon facts |
| canon.update | ✅ | ✅ | ✅ | ❌ | Edit canon facts |
| canon.delete | ✅ | ✅ | ❌ | ❌ | Remove canon facts |
| **Security** |
| security.e2ee.toggle | ✅ | ✅ | ❌ | ❌ | Enable/disable E2EE |
| security.audit.view | ✅ | ❌ | ❌ | ❌ | View audit logs |
| **Export/Import** |
| export.project | ✅ | ✅ | ✅ | ❌ | Export project data |
| import.project | ✅ | ✅ | ❌ | ❌ | Import project data |

## Special Rules

1. **Owner Override**: OWNER can perform any action regardless of matrix
2. **Self Actions**: Users can always update their own profile
3. **Cascade Permissions**: Higher roles inherit all lower role permissions
4. **Project Context**: All permissions are evaluated within project context
```

### 2. Create Policy Service

Create `/apps/api/src/auth/policy.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { Role } from '@nelo/db';

export type Action = 
  | 'project.create' | 'project.delete' | 'project.update' | 'project.invite'
  | 'scene.create' | 'scene.update' | 'scene.delete' | 'scene.restore' | 'scene.read'
  | 'ai.generate' | 'ai.provider.add' | 'ai.provider.delete' | 'ai.budget.set'
  | 'refactor.create' | 'refactor.apply' | 'refactor.force'
  | 'entity.create' | 'entity.update' | 'entity.delete'
  | 'canon.create' | 'canon.update' | 'canon.delete'
  | 'security.e2ee.toggle' | 'security.audit.view'
  | 'export.project' | 'import.project';

@Injectable()
export class PolicyService {
  private readonly permissions: Record<Action, Role[]> = {
    // Project Management
    'project.create': ['OWNER'],
    'project.delete': ['OWNER'],
    'project.update': ['OWNER', 'MAINTAINER'],
    'project.invite': ['OWNER', 'MAINTAINER'],
    
    // Content Management
    'scene.create': ['OWNER', 'MAINTAINER', 'WRITER'],
    'scene.update': ['OWNER', 'MAINTAINER', 'WRITER'],
    'scene.delete': ['OWNER', 'MAINTAINER', 'WRITER'],
    'scene.restore': ['OWNER', 'MAINTAINER'],
    'scene.read': ['OWNER', 'MAINTAINER', 'WRITER', 'READER'],
    
    // AI Generation
    'ai.generate': ['OWNER', 'MAINTAINER', 'WRITER'],
    'ai.provider.add': ['OWNER', 'MAINTAINER'],
    'ai.provider.delete': ['OWNER'],
    'ai.budget.set': ['OWNER', 'MAINTAINER'],
    
    // Refactoring
    'refactor.create': ['OWNER', 'MAINTAINER', 'WRITER'],
    'refactor.apply': ['OWNER', 'MAINTAINER'],
    'refactor.force': ['OWNER'],
    
    // Codex
    'entity.create': ['OWNER', 'MAINTAINER', 'WRITER'],
    'entity.update': ['OWNER', 'MAINTAINER', 'WRITER'],
    'entity.delete': ['OWNER', 'MAINTAINER'],
    'canon.create': ['OWNER', 'MAINTAINER', 'WRITER'],
    'canon.update': ['OWNER', 'MAINTAINER', 'WRITER'],
    'canon.delete': ['OWNER', 'MAINTAINER'],
    
    // Security
    'security.e2ee.toggle': ['OWNER', 'MAINTAINER'],
    'security.audit.view': ['OWNER'],
    
    // Export/Import
    'export.project': ['OWNER', 'MAINTAINER', 'WRITER'],
    'import.project': ['OWNER', 'MAINTAINER'],
  };
  
  can(role: Role, action: Action): boolean {
    // OWNER can do anything
    if (role === 'OWNER') return true;
    
    const allowedRoles = this.permissions[action];
    return allowedRoles?.includes(role) ?? false;
  }
  
  async checkProjectPermission(
    userId: string,
    projectId: string,
    action: Action,
    prisma: any
  ): Promise<boolean> {
    const membership = await prisma.projectMember.findFirst({
      where: { userId, projectId }
    });
    
    if (!membership) return false;
    return this.can(membership.role, action);
  }
}
```

### 3. Create Policy Guard

Create `/apps/api/src/auth/guards/policy.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { PolicyService, Action } from '../policy.service';
import { PrismaClient } from '@nelo/db';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly action: Action,
    @Inject(PolicyService) private readonly policyService: PolicyService,
    @Inject(PrismaClient) private readonly prisma: PrismaClient
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    
    // Extract projectId from request (params, body, or query)
    const projectId = request.params.projectId || 
                     request.body?.projectId || 
                     request.query?.projectId;
    
    if (!projectId) {
      // For project.create, no projectId needed
      if (this.action === 'project.create') {
        return true; // Any authenticated user can create projects
      }
      throw new ForbiddenException('Project context required');
    }
    
    const hasPermission = await this.policyService.checkProjectPermission(
      user.sub,
      projectId,
      this.action,
      this.prisma
    );
    
    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions for action: ${this.action}`);
    }
    
    return true;
  }
}

// Factory function for creating guards with specific actions
export function RequirePermission(action: Action) {
  class DynamicPolicyGuard extends PolicyGuard {
    constructor(policyService: PolicyService, prisma: PrismaClient) {
      super(action, policyService, prisma);
    }
  }
  return DynamicPolicyGuard;
}
```

### 4. Apply Guards to Controllers

Example in ScenesController:
```typescript
import { RequirePermission } from '../auth/guards/policy.guard';

@Controller('scenes')
export class ScenesController {
  @Post()
  @UseGuards(RequirePermission('scene.create'))
  async create(@Body() dto: CreateSceneDto) {
    // ...
  }
  
  @Patch(':id')
  @UseGuards(RequirePermission('scene.update'))
  async update(@Param('id') id: string, @Body() dto: UpdateSceneDto) {
    // ...
  }
  
  @Delete(':id')
  @UseGuards(RequirePermission('scene.delete'))
  async delete(@Param('id') id: string) {
    // ...
  }
  
  @Post(':id/restore')
  @UseGuards(RequirePermission('scene.restore'))
  async restore(@Param('id') id: string) {
    // ...
  }
}
```

## Testing Requirements

### Unit Tests for PolicyService
```typescript
describe('PolicyService', () => {
  describe('can', () => {
    it('should allow OWNER to do anything', () => {
      expect(policyService.can('OWNER', 'scene.delete')).toBe(true);
      expect(policyService.can('OWNER', 'project.delete')).toBe(true);
    });
    
    it('should restrict WRITER from admin actions', () => {
      expect(policyService.can('WRITER', 'scene.create')).toBe(true);
      expect(policyService.can('WRITER', 'scene.restore')).toBe(false);
      expect(policyService.can('WRITER', 'project.delete')).toBe(false);
    });
    
    it('should restrict READER to read-only', () => {
      expect(policyService.can('READER', 'scene.read')).toBe(true);
      expect(policyService.can('READER', 'scene.create')).toBe(false);
    });
  });
});
```

### Integration Tests
```typescript
describe('Permission Guards', () => {
  it('should allow WRITER to create scenes', async () => {
    const response = await request(app)
      .post('/scenes')
      .set('Authorization', `Bearer ${writerToken}`)
      .send({ contentMd: 'Test', projectId, chapterId });
    
    expect(response.status).toBe(201);
  });
  
  it('should deny READER from creating scenes', async () => {
    const response = await request(app)
      .post('/scenes')
      .set('Authorization', `Bearer ${readerToken}`)
      .send({ contentMd: 'Test', projectId, chapterId });
    
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Insufficient permissions');
  });
});
```

## Files to Modify/Create
- `/docs/permissions.md` - Permission matrix documentation
- `/apps/api/src/auth/policy.service.ts` - Permission logic
- `/apps/api/src/auth/guards/policy.guard.ts` - Guard implementation
- `/apps/api/src/auth/auth.module.ts` - Export PolicyService
- All controllers - Apply appropriate guards
- `/apps/api/tests/permissions.test.ts` - Permission tests

## Validation Commands
```bash
# Run tests
cd apps/api
pnpm test permissions

# Test permission denial
curl -X POST http://localhost:3001/scenes \
  -H "Authorization: Bearer $READER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentMd": "Test"}' 
# Should return 403

# Test permission success
curl -X POST http://localhost:3001/scenes \
  -H "Authorization: Bearer $WRITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentMd": "Test", "projectId": "...", "chapterId": "..."}'
# Should return 201
```

## Notes
- Start with core actions, expand as needed
- Consider caching permission checks for performance
- Future: Add delegation (temporary permission grants)
- Future: Add team-level permissions
- Monitor performance impact of permission checks