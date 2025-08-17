# Ticket: 00-structural/012 - Error Handling Standards

## Priority
**High** - Critical for production stability and debugging

## Spec Reference
- Consistent error responses across API
- User-friendly error messages
- Proper error tracking

## Dependencies
- 00-structural/004 (JWT Authentication) - For auth errors

## Current State
- Basic NestJS exception filters
- Inconsistent error formats
- No error tracking
- Technical errors exposed to users

## Target State
- Standardized error response format
- Error codes for client handling
- User-friendly messages
- Sentry integration for tracking
- Sensitive data scrubbing

## Acceptance Criteria
- [ ] Standard error response format defined
- [ ] Custom exception classes created
- [ ] Global exception filter implemented
- [ ] Sentry integration configured
- [ ] Error codes documented
- [ ] Sensitive data never exposed
- [ ] Tests cover error scenarios

## Implementation Steps

### 1. Define Standard Error Format

Create `/apps/api/src/common/interfaces/error-response.interface.ts`:
```typescript
export interface ErrorResponse {
  statusCode: number;
  code: string; // Machine-readable code
  message: string; // User-friendly message
  timestamp: string;
  path: string;
  requestId?: string;
  details?: Record<string, any>; // Additional context (dev only)
}
```

### 2. Create Custom Exceptions

Create `/apps/api/src/common/exceptions/business.exceptions.ts`:
```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, any>
  ) {
    super({ code, message, details }, statusCode);
  }
}

export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, id: string) {
    super(
      'RESOURCE_NOT_FOUND',
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      { resource, id }
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(errors: Record<string, string[]>) {
    super(
      'VALIDATION_FAILED',
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      { errors }
    );
  }
}

export class QuotaExceededException extends BusinessException {
  constructor(resource: string, limit: number, used: number) {
    super(
      'QUOTA_EXCEEDED',
      `${resource} quota exceeded`,
      HttpStatus.PAYMENT_REQUIRED,
      { resource, limit, used }
    );
  }
}

export class ConflictException extends BusinessException {
  constructor(message: string, details?: Record<string, any>) {
    super(
      'CONFLICT',
      message,
      HttpStatus.CONFLICT,
      details
    );
  }
}
```

### 3. Create Global Exception Filter

Create `/apps/api/src/filters/global-exception.filter.ts`:
```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = uuidv4();
    
    // Attach request ID for tracing
    response.setHeader('X-Request-Id', requestId);
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, any> | undefined;
    
    // Handle different exception types
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;
        code = res.code || this.getDefaultCode(status);
        message = res.message || exception.message;
        details = res.details;
      } else {
        message = exceptionResponse.toString();
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors to Sentry
      Sentry.captureException(exception, {
        tags: {
          requestId,
          path: request.url,
          method: request.method,
        },
        user: {
          id: (request as any).user?.id,
        },
      });
      
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        { requestId, path: request.url }
      );
    }
    
    // Scrub sensitive data in production
    if (process.env.NODE_ENV === 'production') {
      details = this.scrubSensitiveData(details);
      
      // Don't expose internal errors
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        message = 'An error occurred while processing your request';
      }
    }
    
    const errorResponse: ErrorResponse = {
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      ...(process.env.NODE_ENV !== 'production' && details && { details }),
    };
    
    response.status(status).json(errorResponse);
  }
  
  private getDefaultCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] || 'ERROR';
  }
  
  private scrubSensitiveData(data: any): any {
    if (!data) return data;
    
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
      'creditCard',
      'ssn',
    ];
    
    const scrub = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(k => lowerKey.includes(k))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          result[key] = scrub(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
      
      return result;
    };
    
    return scrub(data);
  }
}
```

### 4. Configure Sentry

Install and configure:
```bash
pnpm add @sentry/node @sentry/integrations
```

Create `/apps/api/src/config/sentry.config.ts`:
```typescript
import * as Sentry from '@sentry/node';
import { RewriteFrames } from '@sentry/integrations';

export function initSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new RewriteFrames({
          root: global.__dirname,
        }),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event, hint) {
        // Scrub sensitive data
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
  }
}
```

### 5. Apply to App Module

Update `/apps/api/src/main.ts`:
```typescript
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { initSentry } from './config/sentry.config';

async function bootstrap() {
  initSentry();
  
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // ... rest of configuration
}
```

## Testing Requirements

### Unit Tests
```typescript
describe('GlobalExceptionFilter', () => {
  it('should format business exceptions correctly', () => {
    const exception = new ResourceNotFoundException('User', '123');
    const response = filter.catch(exception, mockHost);
    
    expect(response.code).toBe('RESOURCE_NOT_FOUND');
    expect(response.statusCode).toBe(404);
  });
  
  it('should scrub sensitive data', () => {
    const exception = new ValidationException({
      password: ['too short'],
      apiKey: ['invalid'],
    });
    
    const response = filter.catch(exception, mockHost);
    expect(response.details.password).toBe('[REDACTED]');
  });
  
  it('should capture unexpected errors to Sentry', () => {
    const error = new Error('Unexpected');
    filter.catch(error, mockHost);
    
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
  });
});
```

## Files to Create/Modify
- `/apps/api/src/common/interfaces/error-response.interface.ts`
- `/apps/api/src/common/exceptions/business.exceptions.ts`
- `/apps/api/src/filters/global-exception.filter.ts`
- `/apps/api/src/config/sentry.config.ts`
- `/apps/api/src/main.ts` - Apply global filter
- `/apps/api/.env` - Add SENTRY_DSN

## Validation Commands
```bash
# Install dependencies
cd apps/api
pnpm add @sentry/node @sentry/integrations uuid

# Test error handling
curl http://localhost:3001/nonexistent
# Should return standardized 404 error

# Test validation error
curl -X POST http://localhost:3001/scenes \
  -H "Content-Type: application/json" \
  -d '{}'
# Should return validation error format

# Check Sentry integration
# Trigger an error and verify it appears in Sentry dashboard
```

## Notes
- Use business exceptions for expected errors
- Log unexpected errors to Sentry
- Never expose stack traces in production
- Include request IDs for tracing
- Consider implementing correlation IDs for distributed tracing
- Future: Add error recovery strategies
- Future: Implement circuit breakers for external services