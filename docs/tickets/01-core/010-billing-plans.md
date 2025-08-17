# Ticket: 01-core/010 - Billing & Plans

## Priority
**Low** - Post-MVP feature for hosted/SaaS version

## Implementation Decision (2024)
**Use LemonSqueezy for MVP, plan for Stripe at scale**:
- LemonSqueezy acts as Merchant of Record (handles all tax compliance)
- Fastest setup with minimal friction (important for MVP)
- Migrate to Stripe when you need more control
- Avoids global tax complexity initially

## Spec Reference
- `/docs/spec-pack.md` - Budget model (lines 461-468)
- Spec Evolution #010 (Billing & Plans) - Enhanced billing architecture

## Dependencies
- 01-core/007 (Authentication & Access) - Must be complete
- 00-structural/007 (Permission Matrix) - For plan-based permissions

## Current State
- Budget model exists in schema
- No plan definitions
- No usage metering
- No enforcement of limits

## Target State
- Defined billing plans (Free, Starter, Pro, Team)
- Usage metering and enforcement
- Plan-based feature gates
- Billing integration ready (Stripe/Paddle)

## Acceptance Criteria
- [ ] Plan definitions documented
- [ ] PlanGuard for feature gating
- [ ] Usage metering for AI tokens
- [ ] Project count limits enforced
- [ ] Collaborator limits enforced
- [ ] Daily token caps enforced
- [ ] Plan upgrade/downgrade flow
- [ ] Usage dashboard data

## Implementation Steps

### 1. Document Hosted Plans

Create `/docs/hosted-plans.md`:
```markdown
# Hosted Plans

## Plan Tiers

### Free (Beta)
- **Price**: $0/month
- **Projects**: 1
- **Collaborators**: 2 per project
- **AI Models**: Local only (Ollama/LM Studio)
- **Storage**: 100MB
- **Support**: Community forum
- **Features**:
  - Basic editor
  - Local AI only
  - Manual save only

### Starter
- **Price**: $8/month
- **Projects**: 3
- **Collaborators**: 5 per project
- **AI Models**: All cloud models
- **Daily AI Tokens**: 200,000
- **Storage**: 1GB
- **Support**: Email (48hr response)
- **Features**:
  - All Free features
  - Cloud AI models
  - Auto-save
  - Basic analytics

### Pro
- **Price**: $20/month
- **Projects**: 10
- **Collaborators**: 10 per project
- **AI Models**: All cloud models
- **Daily AI Tokens**: 1,000,000
- **Storage**: 10GB
- **Support**: Email (24hr response)
- **Features**:
  - All Starter features
  - Priority AI queue
  - Advanced refactoring
  - Version history (30 days)
  - Export formats (ePub, PDF)

### Team
- **Price**: $50/month
- **Projects**: Unlimited
- **Collaborators**: 25 per project
- **AI Models**: All cloud models + priority
- **Daily AI Tokens**: 3,000,000
- **Storage**: 100GB
- **Support**: Priority email + Slack
- **Features**:
  - All Pro features
  - SSO/SAML
  - Audit logs
  - Custom AI models
  - API access
  - Version history (unlimited)
  - Team management

### Enterprise
- **Price**: Custom
- **Projects**: Unlimited
- **Collaborators**: Unlimited
- **AI Models**: Custom + dedicated
- **Daily AI Tokens**: Custom
- **Storage**: Custom
- **Support**: Dedicated CSM
- **Features**:
  - All Team features
  - On-premise deployment
  - Custom integrations
  - SLA guarantees
  - Training & onboarding

## Enforcement Points

1. **Project Creation**: Check project count limit
2. **Member Invitation**: Check collaborator limit
3. **AI Generation**: Check daily token usage
4. **File Upload**: Check storage usage
5. **Feature Access**: Gate premium features

## Metering

Track and store:
- Projects created per user
- Active collaborators per project
- Tokens used per day (input + output)
- Storage used (database + files)
- API calls per hour

## Billing Integration

Stripe/Paddle webhooks for:
- subscription.created
- subscription.updated
- subscription.deleted
- payment.failed
- usage.record.created
```

### 2. Extend User Model for Plans

Update schema:
```prisma
enum PlanTier {
  FREE
  STARTER
  PRO
  TEAM
  ENTERPRISE
}

enum BillingInterval {
  MONTHLY
  YEARLY
}

model Subscription {
  id                String           @id @default(uuid())
  userId            String           @unique
  user              User             @relation(fields: [userId], references: [id])
  planTier          PlanTier         @default(FREE)
  billingInterval   BillingInterval?
  stripeCustomerId  String?
  stripeSubId       String?
  currentPeriodEnd  DateTime?
  cancelAtPeriodEnd Boolean          @default(false)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}

model UsageRecord {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime @default(now()) @db.Date
  projects    Int      @default(0)
  aiTokens    Int      @default(0)
  storageBytes BigInt   @default(0)
  apiCalls    Int      @default(0)
  
  @@unique([userId, date])
  @@index([userId, date])
}
```

### 3. Create Plan Service

Create `/apps/api/src/billing/plan.service.ts`:
```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient, PlanTier } from '@nelo/db';

interface PlanLimits {
  maxProjects: number;
  maxCollaborators: number;
  maxDailyTokens: number;
  maxStorageBytes: number;
  features: string[];
}

@Injectable()
export class PlanService {
  private readonly limits: Record<PlanTier, PlanLimits> = {
    FREE: {
      maxProjects: 1,
      maxCollaborators: 2,
      maxDailyTokens: 0, // Local only
      maxStorageBytes: 100 * 1024 * 1024, // 100MB
      features: ['local_ai', 'basic_editor'],
    },
    STARTER: {
      maxProjects: 3,
      maxCollaborators: 5,
      maxDailyTokens: 200000,
      maxStorageBytes: 1024 * 1024 * 1024, // 1GB
      features: ['cloud_ai', 'auto_save', 'basic_analytics'],
    },
    PRO: {
      maxProjects: 10,
      maxCollaborators: 10,
      maxDailyTokens: 1000000,
      maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10GB
      features: ['priority_queue', 'advanced_refactor', 'version_history', 'export_formats'],
    },
    TEAM: {
      maxProjects: 999999, // Effectively unlimited
      maxCollaborators: 25,
      maxDailyTokens: 3000000,
      maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100GB
      features: ['sso', 'audit_logs', 'custom_models', 'api_access'],
    },
    ENTERPRISE: {
      maxProjects: 999999,
      maxCollaborators: 999999,
      maxDailyTokens: 999999999,
      maxStorageBytes: 999999999999,
      features: ['all'],
    },
  };
  
  constructor(private readonly prisma: PrismaClient) {}
  
  async getUserPlan(userId: string): Promise<PlanTier> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId }
    });
    
    return subscription?.planTier || 'FREE';
  }
  
  async checkProjectLimit(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limits = this.limits[plan];
    
    const projectCount = await this.prisma.project.count({
      where: { 
        members: { some: { userId, role: 'OWNER' } }
      }
    });
    
    if (projectCount >= limits.maxProjects) {
      throw new ForbiddenException(
        `Project limit reached. ${plan} plan allows ${limits.maxProjects} projects.`
      );
    }
  }
  
  async checkCollaboratorLimit(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { 
        members: { where: { role: 'OWNER' } }
      }
    });
    
    if (!project) throw new Error('Project not found');
    
    const ownerId = project.members[0]?.userId;
    if (!ownerId) throw new Error('Project owner not found');
    
    const plan = await this.getUserPlan(ownerId);
    const limits = this.limits[plan];
    
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId }
    });
    
    if (memberCount >= limits.maxCollaborators) {
      throw new ForbiddenException(
        `Collaborator limit reached. ${plan} plan allows ${limits.maxCollaborators} collaborators.`
      );
    }
  }
  
  async checkDailyTokenUsage(userId: string, tokensNeeded: number): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limits = this.limits[plan];
    
    if (limits.maxDailyTokens === 0) {
      throw new ForbiddenException('Cloud AI not available on Free plan');
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usage = await this.prisma.usageRecord.findUnique({
      where: {
        userId_date: { userId, date: today }
      }
    });
    
    const tokensUsed = usage?.aiTokens || 0;
    
    if (tokensUsed + tokensNeeded > limits.maxDailyTokens) {
      throw new ForbiddenException(
        `Daily token limit reached. Used ${tokensUsed}/${limits.maxDailyTokens} tokens today.`
      );
    }
  }
  
  async recordTokenUsage(userId: string, tokens: number): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.prisma.usageRecord.upsert({
      where: {
        userId_date: { userId, date: today }
      },
      update: {
        aiTokens: { increment: tokens }
      },
      create: {
        userId,
        date: today,
        aiTokens: tokens
      }
    });
  }
  
  hasFeature(plan: PlanTier, feature: string): boolean {
    const limits = this.limits[plan];
    return limits.features.includes(feature) || limits.features.includes('all');
  }
}
```

### 4. Create Plan Guard

Create `/apps/api/src/billing/guards/plan.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PlanService } from '../plan.service';

export type PlanFeature = 
  | 'cloud_ai' | 'auto_save' | 'priority_queue' 
  | 'advanced_refactor' | 'export_formats' | 'api_access';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly feature: PlanFeature,
    private readonly planService: PlanService
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }
    
    const plan = await this.planService.getUserPlan(user.sub);
    
    if (!this.planService.hasFeature(plan, this.feature)) {
      throw new ForbiddenException(
        `Feature "${this.feature}" requires upgrade from ${plan} plan`
      );
    }
    
    return true;
  }
}

export function RequirePlan(feature: PlanFeature) {
  class DynamicPlanGuard extends PlanGuard {
    constructor(planService: PlanService) {
      super(feature, planService);
    }
  }
  return DynamicPlanGuard;
}
```

### 5. Apply to Controllers

Example in GenerationController:
```typescript
@Controller('generate')
export class GenerationController {
  @Post()
  @UseGuards(RequirePlan('cloud_ai'))
  async generate(@Body() dto: GenerateDto) {
    // Check token usage before generation
    await this.planService.checkDailyTokenUsage(
      req.user.sub,
      estimatedTokens
    );
    
    // Generate...
    
    // Record usage after
    await this.planService.recordTokenUsage(
      req.user.sub,
      actualTokens
    );
  }
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('PlanService', () => {
  it('should enforce project limits', async () => {
    // User with FREE plan and 1 project
    await expect(planService.checkProjectLimit(userId))
      .rejects.toThrow('Project limit reached');
  });
  
  it('should track daily token usage', async () => {
    await planService.recordTokenUsage(userId, 100000);
    await planService.recordTokenUsage(userId, 100000);
    
    await expect(planService.checkDailyTokenUsage(userId, 50000))
      .rejects.toThrow('Daily token limit reached');
  });
});
```

### Integration Tests
```typescript
describe('Plan Enforcement', () => {
  it('should block cloud AI for free users', async () => {
    const response = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send({ /* ... */ });
    
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Cloud AI not available');
  });
});
```

## Files to Modify/Create
- `/docs/hosted-plans.md` - Plan documentation
- `/packages/db/prisma/schema.prisma` - Subscription models
- `/apps/api/src/billing/plan.service.ts` - Plan logic
- `/apps/api/src/billing/guards/plan.guard.ts` - Feature guards
- `/apps/api/src/billing/billing.module.ts` - Module setup
- Various controllers - Apply plan guards

## Validation Commands
```bash
# Run migration
cd packages/db
pnpm prisma migrate dev

# Test plan limits
curl -X POST http://localhost:3001/projects \
  -H "Authorization: Bearer $FREE_USER_TOKEN"
# Should fail after 1 project

# Test feature gate
curl -X POST http://localhost:3001/generate \
  -H "Authorization: Bearer $FREE_USER_TOKEN"
# Should return 403 for cloud AI
```

## Notes
- **2024 Decision**: LemonSqueezy for MVP (MoR = no tax headaches)
- **Migration Path**: Start with LemonSqueezy → Move to Stripe when you need:
  - Custom billing logic
  - Advanced subscription features
  - Lower transaction fees at scale
- LemonSqueezy handles VAT/GST compliance globally
- One invoice per month to LemonSqueezy vs thousands to customers
- Start with hard-coded limits, move to database later
- Consider grace periods for downgrades
- Add webhook handlers for payment provider
- Cache plan checks for performance
- Future: Usage-based billing for enterprise
- Future: Team billing (multiple users per subscription)

## LemonSqueezy Quick Setup
1. Create account at lemonsqueezy.com
2. Set up products matching plan tiers
3. Use their SDK: `npm install @lemonsqueezy/lemonsqueezy.js`
4. Implement webhooks for subscription events
5. Store `lemonSqueezyCustomerId` instead of `stripeCustomerId`