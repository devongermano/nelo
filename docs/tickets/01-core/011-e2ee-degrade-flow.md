# Ticket: 01-core/011 - E2EE Degrade Flow

## Priority
**High** - Critical for E2EE functionality

## Spec Reference
- `/docs/spec-pack.md` - E2EE guardrails (lines 6-7)
- Spec Evolution #011 (E2EE Degrade Response Pattern)
- `/docs/e2ee-degrade.md` - Detailed flow documentation

## Dependencies
- 01-core/005 (AI Generation Suite) - For generation endpoints
- 00-structural/001 (Database Schema) - For SecurityEvent model

## Current State
- E2EE concept mentioned in spec
- No implementation of conflict detection
- No user choice mechanism
- No security event logging

## Target State
- Detect E2EE conflicts with cloud features
- Return 409 Conflict with user options
- Support temporary E2EE disable
- Log security events for audit
- Frontend modal for user choice

## Acceptance Criteria
- [ ] 409 response when E2EE conflicts with cloud AI
- [ ] Response includes three options (local model, disable, cancel)
- [ ] SecurityEvent model created and migrations run
- [ ] Security events logged for E2EE exceptions
- [ ] Frontend modal displays options clearly
- [ ] Temporary disable is truly single-request only
- [ ] Local model switching works
- [ ] Tests cover all three user choices

## Implementation Steps

### 1. Create SecurityEvent Model

Add to `/packages/db/prisma/schema.prisma`:
```prisma
model SecurityEvent {
  id        String   @id @default(uuid())
  type      String   // E2EE_TEMPORARY_DISABLE, KEY_ROTATION, etc.
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  runId     String?
  run       Run?     @relation(fields: [runId], references: [id])
  metadata  Json?    // Additional context
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  
  @@index([userId, type])
  @@index([projectId, createdAt])
}
```

### 2. Create E2EE Conflict Detection

Create `/apps/api/src/security/e2ee.service.ts`:
```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@nelo/db';

export interface E2EEConflictOptions {
  action: 'USE_LOCAL_MODEL' | 'DISABLE_E2EE_FOR_RUN' | 'CANCEL';
  description: string;
  impact?: string;
  maintainsE2ee: boolean;
}

@Injectable()
export class E2EEService {
  constructor(private readonly prisma: PrismaClient) {}
  
  async checkE2EEConflict(
    projectId: string,
    modelProfileId: string
  ): Promise<void> {
    // Get project E2EE status
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { e2eeEnabled: true }
    });
    
    if (!project?.e2eeEnabled) {
      return; // No conflict if E2EE is disabled
    }
    
    // Get model profile
    const modelProfile = await this.prisma.modelProfile.findUnique({
      where: { id: modelProfileId }
    });
    
    if (!modelProfile) {
      throw new Error('Model profile not found');
    }
    
    // Check if model is local
    const localProviders = ['ollama', 'lmstudio'];
    if (localProviders.includes(modelProfile.provider.toLowerCase())) {
      return; // No conflict with local models
    }
    
    // Throw conflict exception with options
    throw new ConflictException({
      code: 'E2EE_INCOMPATIBLE',
      message: 'End-to-end encryption is enabled but the selected model requires cloud processing',
      options: this.getConflictOptions()
    });
  }
  
  private getConflictOptions(): E2EEConflictOptions[] {
    return [
      {
        action: 'USE_LOCAL_MODEL',
        description: 'Switch to a local AI model that runs on your device',
        impact: 'Slower generation, limited model selection',
        maintainsE2ee: true
      },
      {
        action: 'DISABLE_E2EE_FOR_RUN',
        description: 'Temporarily send unencrypted content for this operation only',
        impact: 'Content will be decrypted for this specific request',
        maintainsE2ee: false
      },
      {
        action: 'CANCEL',
        description: 'Cancel the operation and maintain encryption',
        impact: 'Operation will not be performed',
        maintainsE2ee: true
      }
    ];
  }
  
  async logSecurityEvent(
    type: string,
    userId: string,
    projectId: string,
    metadata: any,
    request?: any
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type,
        userId,
        projectId,
        metadata,
        ip: request?.ip || request?.connection?.remoteAddress,
        userAgent: request?.headers?.['user-agent']
      }
    });
  }
}
```

### 3. Update Generation Controller

Update `/apps/api/src/generation/generation.controller.ts`:
```typescript
import { E2EEService } from '../security/e2ee.service';

@Controller('generate')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly e2eeService: E2EEService
  ) {}
  
  @Post()
  async generate(
    @Body() dto: GenerateDto,
    @Req() request: any
  ) {
    // Check for E2EE conflict unless explicitly disabled
    if (!dto.e2eeTemporarilyDisabled) {
      await this.e2eeService.checkE2EEConflict(
        dto.projectId,
        dto.modelProfileId
      );
    }
    
    // Log if E2EE was temporarily disabled
    if (dto.e2eeTemporarilyDisabled) {
      await this.e2eeService.logSecurityEvent(
        'E2EE_TEMPORARY_DISABLE',
        request.user.id,
        dto.projectId,
        {
          action: 'AI_GENERATE',
          modelProfile: dto.modelProfileId,
          reason: 'User chose to temporarily disable E2EE'
        },
        request
      );
    }
    
    // Proceed with generation
    return this.generationService.generate(dto);
  }
}
```

### 4. Update Generate DTO

Add to generate DTO:
```typescript
export interface GenerateDto {
  sceneId: string;
  action: 'WRITE' | 'REWRITE' | 'DESCRIBE';
  modelProfileId: string;
  stream?: boolean;
  promptOverride?: any;
  e2eeTemporarilyDisabled?: boolean; // New field
}
```

### 5. Create Frontend Modal Component

Create `/apps/web/src/components/E2EEConflictModal.tsx`:
```typescript
interface E2EEConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoice: (action: 'USE_LOCAL_MODEL' | 'DISABLE_E2EE_FOR_RUN' | 'CANCEL') => void;
  options: E2EEConflictOption[];
}

export function E2EEConflictModal({ isOpen, onClose, onChoice, options }: E2EEConflictModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <WarningIcon />
        End-to-End Encryption Active
      </ModalHeader>
      
      <ModalBody>
        <p>This action requires processing your content on our servers, 
           but your project has end-to-end encryption enabled.</p>
        <p>How would you like to proceed?</p>
      </ModalBody>
      
      <ModalFooter>
        {options.map(option => (
          <Button
            key={option.action}
            onClick={() => onChoice(option.action)}
            variant={option.maintainsE2ee ? 'primary' : 'warning'}
          >
            <Icon name={getIconForAction(option.action)} />
            <div>
              <div>{getActionLabel(option.action)}</div>
              <small>{option.description}</small>
            </div>
          </Button>
        ))}
      </ModalFooter>
    </Modal>
  );
}
```

### 6. Handle 409 in Frontend

Update generation service:
```typescript
async function generateWithAI(params: GenerateParams) {
  try {
    return await api.post('/generate', params);
  } catch (error) {
    if (error.response?.status === 409 && error.response?.data?.code === 'E2EE_INCOMPATIBLE') {
      const choice = await showE2EEConflictModal(error.response.data.options);
      
      switch (choice) {
        case 'USE_LOCAL_MODEL':
          // Switch to local model
          const localModelId = await selectLocalModel();
          return generateWithAI({ ...params, modelProfileId: localModelId });
          
        case 'DISABLE_E2EE_FOR_RUN':
          // Decrypt locally and retry
          const decryptedContent = await decryptContent(params.content);
          return generateWithAI({
            ...params,
            content: decryptedContent,
            e2eeTemporarilyDisabled: true
          });
          
        case 'CANCEL':
          return null;
      }
    }
    throw error;
  }
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('E2EEService', () => {
  it('should detect conflict with cloud model', async () => {
    const project = { e2eeEnabled: true };
    const modelProfile = { provider: 'openai' };
    
    await expect(service.checkE2EEConflict(projectId, modelProfileId))
      .rejects.toThrow(ConflictException);
  });
  
  it('should not conflict with local model', async () => {
    const project = { e2eeEnabled: true };
    const modelProfile = { provider: 'ollama' };
    
    await expect(service.checkE2EEConflict(projectId, modelProfileId))
      .resolves.not.toThrow();
  });
});
```

### Integration Tests
```typescript
describe('E2EE Degrade Flow', () => {
  it('should return 409 for E2EE conflict', async () => {
    const response = await request(app)
      .post('/generate')
      .send({
        projectId: e2eeProjectId,
        modelProfileId: cloudModelId,
        // ...
      });
    
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('E2EE_INCOMPATIBLE');
    expect(response.body.options).toHaveLength(3);
  });
  
  it('should log security event when E2EE disabled', async () => {
    await request(app)
      .post('/generate')
      .send({
        projectId: e2eeProjectId,
        modelProfileId: cloudModelId,
        e2eeTemporarilyDisabled: true
      });
    
    const event = await prisma.securityEvent.findFirst({
      where: { type: 'E2EE_TEMPORARY_DISABLE' }
    });
    
    expect(event).toBeDefined();
    expect(event.metadata.action).toBe('AI_GENERATE');
  });
});
```

### E2E Tests
```typescript
describe('E2EE User Flow', () => {
  it('should handle USE_LOCAL_MODEL choice', async () => {
    // Trigger generation with cloud model
    await page.click('[data-testid="generate-button"]');
    
    // Modal should appear
    await expect(page.locator('[data-testid="e2ee-modal"]')).toBeVisible();
    
    // Choose local model
    await page.click('[data-testid="use-local-model"]');
    
    // Model selector should switch
    await expect(page.locator('[data-testid="model-selector"]'))
      .toContainText('Ollama');
  });
});
```

## Files to Modify/Create
- `/packages/db/prisma/schema.prisma` - Add SecurityEvent model
- `/apps/api/src/security/e2ee.service.ts` - New service
- `/apps/api/src/generation/generation.controller.ts` - Add E2EE check
- `/apps/web/src/components/E2EEConflictModal.tsx` - Frontend modal
- `/apps/api/tests/e2ee-degrade.test.ts` - New tests

## Validation Commands
```bash
# Run migration for SecurityEvent
cd packages/db
pnpm prisma migrate dev

# Test 409 response
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{e2ee-enabled-project}",
    "modelProfileId": "{cloud-model}",
    "sceneId": "...",
    "action": "WRITE"
  }'
# Should return 409 with options

# Test with temporary disable
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{e2ee-enabled-project}",
    "modelProfileId": "{cloud-model}",
    "e2eeTemporarilyDisabled": true,
    "sceneId": "...",
    "action": "WRITE"
  }'
# Should succeed and log security event
```

## Notes
- This is a critical security feature
- Security events should be retained for compliance
- Consider rate limiting E2EE disables
- Future: Support homomorphic encryption
- Future: Client-side AI for E2EE projects