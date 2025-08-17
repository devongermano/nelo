# End-to-End Encryption (E2EE) Degrade Flow

This document describes how Nelo handles conflicts between E2EE and cloud-based features that require server-side processing.

## Overview

When E2EE is enabled for a project, the manuscript content is encrypted on the client before transmission. This provides maximum privacy but prevents certain cloud features from functioning:

- **Cloud AI generation** - Models need plaintext to generate content
- **Server-side search** - Cannot search encrypted content
- **Advanced refactoring** - Server cannot analyze encrypted text
- **Cloud-based grammar checking** - Third-party services need plaintext

## Degrade Flow

### 1. Detection Phase

When a user attempts an action that conflicts with E2EE:

```typescript
// Server detects conflict
if (project.e2eeEnabled && action.requiresPlaintext) {
  return {
    status: 409, // Conflict
    code: "E2EE_INCOMPATIBLE",
    action: action.type,
    options: [...] // See below
  };
}
```

### 2. User Decision

The client presents three options to the user:

#### Option A: Use Local Model
```json
{
  "action": "USE_LOCAL_MODEL",
  "description": "Switch to a local AI model that runs on your device",
  "impact": "Slower generation, limited model selection",
  "maintains_e2ee": true
}
```

#### Option B: Temporary Disable
```json
{
  "action": "DISABLE_E2EE_FOR_RUN",
  "description": "Temporarily send unencrypted content for this operation only",
  "impact": "Content will be decrypted for this specific request",
  "maintains_e2ee": false,
  "duration": "single_request"
}
```

#### Option C: Cancel
```json
{
  "action": "CANCEL",
  "description": "Cancel the operation and maintain encryption",
  "impact": "Operation will not be performed",
  "maintains_e2ee": true
}
```

### 3. Client Presentation

The client should display a modal dialog:

```
┌─────────────────────────────────────────────┐
│  ⚠️  End-to-End Encryption Active           │
├─────────────────────────────────────────────┤
│                                             │
│  This action requires processing your       │
│  content on our servers, but your project   │
│  has end-to-end encryption enabled.         │
│                                             │
│  How would you like to proceed?            │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🖥️  Use Local Model                 │   │
│  │ Process locally (slower but secure)  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🔓 Disable E2EE for This Request    │   │
│  │ Temporarily decrypt (faster)         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ❌ Cancel                            │   │
│  │ Keep encryption, cancel operation    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Learn more about E2EE]                   │
└─────────────────────────────────────────────┘
```

### 4. Action Handling

#### If USE_LOCAL_MODEL:
1. Client switches model selector to local providers (Ollama/LM Studio)
2. Re-attempts the operation with local model
3. No security event logged (E2EE maintained)

#### If DISABLE_E2EE_FOR_RUN:
1. Client creates SecurityEvent audit entry
2. Client decrypts content locally
3. Client sends plaintext with flag `e2eeTemporarilyDisabled: true`
4. Server processes request normally
5. Server logs security exception
6. Response is encrypted before transmission back

#### If CANCEL:
1. Modal closes
2. No action taken
3. User remains in current state

## Security Event Logging

When E2EE is temporarily disabled, create an audit record:

```typescript
interface SecurityEvent {
  id: string;
  type: "E2EE_TEMPORARY_DISABLE";
  userId: string;
  projectId: string;
  timestamp: Date;
  metadata: {
    action: string;           // "AI_GENERATE" | "REFACTOR" | etc.
    modelProfile?: string;    // Which AI model was used
    reason: string;          // "User chose to temporarily disable E2EE"
    ip: string;             // Client IP for audit
    userAgent: string;      // Browser/client info
  };
}
```

## API Implementation

### Request with E2EE Check

```typescript
@Post('/generate')
async generate(@Body() dto: GenerateDto, @Headers() headers: any) {
  const project = await this.getProject(dto.projectId);
  
  // Check for E2EE conflict
  if (project.e2eeEnabled && !dto.useLocalModel) {
    const modelProfile = await this.getModelProfile(dto.modelProfileId);
    
    if (modelProfile.provider !== 'ollama' && modelProfile.provider !== 'lmstudio') {
      throw new ConflictException({
        code: 'E2EE_INCOMPATIBLE',
        message: 'End-to-end encryption is enabled',
        options: [
          { action: 'USE_LOCAL_MODEL', ... },
          { action: 'DISABLE_E2EE_FOR_RUN', ... },
          { action: 'CANCEL', ... }
        ]
      });
    }
  }
  
  // Check for temporary disable flag
  if (dto.e2eeTemporarilyDisabled) {
    await this.logSecurityEvent({
      type: 'E2EE_TEMPORARY_DISABLE',
      userId: req.user.id,
      projectId: dto.projectId,
      metadata: { action: 'AI_GENERATE', ... }
    });
  }
  
  // Process normally
  return this.processGeneration(dto);
}
```

## Client Implementation

### Handling 409 Response

```typescript
async function generateWithAI(params: GenerateParams) {
  try {
    const response = await api.generate(params);
    return response;
  } catch (error) {
    if (error.status === 409 && error.code === 'E2EE_INCOMPATIBLE') {
      const choice = await showE2EEConflictModal(error.options);
      
      switch (choice.action) {
        case 'USE_LOCAL_MODEL':
          // Switch to local model
          params.modelProfileId = await selectLocalModel();
          return generateWithAI(params); // Retry
          
        case 'DISABLE_E2EE_FOR_RUN':
          // Decrypt content and retry
          params.content = await decryptLocally(params.content);
          params.e2eeTemporarilyDisabled = true;
          return generateWithAI(params); // Retry with flag
          
        case 'CANCEL':
          return null; // User cancelled
      }
    }
    throw error; // Other errors
  }
}
```

## Privacy Considerations

### What Gets Logged

When E2EE is temporarily disabled:
- Timestamp of exception
- User who made the decision
- Type of operation requested
- Model/service that required plaintext
- IP address for security audit

### What Does NOT Get Logged
- The actual content (even when decrypted)
- The generated output
- Any personally identifiable information from the content

### Data Retention
- Security events retained for 90 days
- Aggregated statistics kept indefinitely
- Individual events purged after retention period

## User Education

### In-App Messaging

Educate users about the implications:

1. **First Time**: Detailed explanation of why conflict exists
2. **Subsequent Times**: Shortened dialog with "Don't show again" option
3. **Settings Page**: Full documentation of E2EE implications

### Recommended Defaults

- Projects with sensitive content: E2EE enabled, local models preferred
- Collaborative projects: E2EE disabled for better features
- Personal journals: E2EE enabled with occasional exceptions

## Metrics & Monitoring

Track (in aggregate, not per-user):
- How often E2EE conflicts occur
- Which option users choose most
- Which features trigger conflicts
- Abandonment rate (choosing CANCEL)

## Future Enhancements

1. **Homomorphic Encryption**: Process encrypted data without decryption
2. **Federated Learning**: Train models without accessing raw data
3. **Trusted Execution Environments**: Process in secure enclaves
4. **Differential Privacy**: Add noise to maintain privacy while enabling features
5. **Client-Side AI**: More powerful local models eliminating conflicts

## Testing

### Test Scenarios

1. **E2EE Enabled + Cloud Model** → Should return 409
2. **E2EE Enabled + Local Model** → Should succeed
3. **E2EE Disabled + Any Model** → Should succeed
4. **Temporary Disable Flow** → Should log SecurityEvent
5. **Cancel Flow** → Should maintain encryption

### Security Testing

- Verify plaintext is never logged when E2EE is active
- Confirm security events are created correctly
- Test that temporary disable is truly temporary (one request)
- Verify encrypted response even after temporary disable