# Ticket: 00-structural/004 - Auth Package Setup

## Priority
**High** - Authentication and authorization are required for most endpoints

## Spec Reference
`/docs/spec-pack.md` sections:
- Section 0: Project Guardrails - Auth & Tenancy (line 4)
- Role enum definition (line 275)
- User, Team, Membership, ProjectMember models (lines 283-293, 556-581)

## Dependencies
- 00-structural/000 (Complete Typia Setup) - Need Typia for validation
- 00-structural/002 (Shared Types Package) - Need type definitions

## Current State
- ❌ No authentication package exists
- ❌ No JWT handling
- ❌ No auth middleware or guards
- ✅ User model exists in database
- ⚠️ Role enum needs updating to include MAINTAINER, WRITER, READER (per ticket 001)
- ✅ Will use Typia for validation

## Target State
A new `@nelo/auth` package containing:
- JWT token generation and validation with refresh tokens
- Password hashing using argon2 (more secure than bcrypt)
- Auth middleware and guards for NestJS
- Role-based access control (RBAC) with project-level permissions
- Session management with Redis
- Rate limiting for auth endpoints
- OAuth provider support structure
- Two-factor authentication (2FA) support structure

## Acceptance Criteria
- [ ] Package `@nelo/auth` exists at `/packages/auth`
- [ ] JWT utilities with refresh token rotation
- [ ] Password hashing using argon2
- [ ] NestJS guards for role-based access
- [ ] Auth middleware/decorators created
- [ ] Rate limiting configured
- [ ] Redis session management
- [ ] Package properly exports all utilities
- [ ] Comprehensive security tests
- [ ] OWASP compliance for auth flows

## Implementation Steps

1. **Create package structure**:
   ```bash
   mkdir -p packages/auth/src/{guards,decorators,utils}
   cd packages/auth
   ```

2. **Create package.json**:
   ```json
   {
     "name": "@nelo/auth",
     "version": "0.0.0",
     "private": true,
     "main": "src/index.ts",
     "types": "src/index.ts",
     "scripts": {
       "test": "vitest",
       "typecheck": "tsc --noEmit"
     },
     "dependencies": {
       "@nelo/db": "workspace:*",
       "@nelo/shared-types": "workspace:*",
       "@nestjs/common": "^11.1.6",
       "@nestjs/jwt": "^10.2.0",
       "@nestjs/passport": "^10.0.3",
       "argon2": "^0.31.2",
       "passport": "^0.7.0",
       "passport-jwt": "^4.0.1",
       "passport-local": "^1.0.0"
     },
     "devDependencies": {
       "@types/node": "^20.0.0",
       "@types/passport-jwt": "^4.0.1",
       "@types/passport-local": "^1.0.38",
       "typescript": "^5.3.0",
       "vitest": "^0.34.0"
     }
   }
   ```

3. **Create JWT utilities** (`/packages/auth/src/utils/jwt.ts`):
   ```typescript
   import * as jwt from 'jsonwebtoken';
   
   import { tags } from 'typia';
   
   export interface JwtPayload {
     sub: string & tags.Format<"uuid">; // user id
     email: string & tags.Format<"email">;
     roles?: string[];
     projectId?: string & tags.Format<"uuid">;
     sessionId?: string & tags.Format<"uuid">;
     iat?: number;
     exp?: number;
     jti?: string; // JWT ID for blacklisting
   }
   
   export class JwtService {
     constructor(
       private readonly secret: string,
       private readonly expiresIn: string = '7d'
     ) {}
   
     generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
       const jti = crypto.randomUUID(); // For potential blacklisting
       const options: jwt.SignOptions = {
         expiresIn: this.expiresIn,
         issuer: 'nelo-api',
         jwtid: jti
       };
       
       return jwt.sign({ ...payload, jti }, this.secret, options);
     }
   
     async verifyToken(token: string): Promise<JwtPayload> {
       const options: jwt.VerifyOptions = {
         issuer: 'nelo-api',
         complete: false
       };
       
       try {
         const payload = jwt.verify(token, this.secret, options) as JwtPayload;
         
         // Check if token is blacklisted (requires Redis)
         if (await this.isBlacklisted(payload.jti)) {
           throw new Error('Token has been revoked');
         }
         
         return payload;
       } catch (error) {
         throw new UnauthorizedException('Invalid token');
       }
     }
     
     private async isBlacklisted(jti?: string): Promise<boolean> {
       if (!jti) return false;
       // Check Redis for blacklisted tokens
       // Implementation depends on Redis client
       return false;
     }
   
     async generateRefreshToken(userId: string): Promise<string> {
       const tokenId = crypto.randomUUID();
       const token = jwt.sign(
         { sub: userId, type: 'refresh', jti: tokenId },
         this.secret,
         { expiresIn: '30d' }
       );
       
       // Store in Redis with expiration
       await this.storeRefreshToken(userId, tokenId);
       return token;
     }
     
     async rotateRefreshToken(oldToken: string): Promise<string> {
       const payload = jwt.verify(oldToken, this.secret) as any;
       
       // Invalidate old token
       await this.revokeToken(payload.jti);
       
       // Generate new token
       return this.generateRefreshToken(payload.sub);
     }
   }
   ```

4. **Create password utilities** (`/packages/auth/src/utils/password.ts`):
   ```typescript
   import * as argon2 from 'argon2';
   import { randomBytes } from 'crypto';
   import { tags } from 'typia';
   import typia from 'typia';
   
   export class PasswordService {
     // Argon2id configuration (OWASP recommended)
     private readonly argonOptions: argon2.Options = {
       type: argon2.argon2id,
       memoryCost: 65536, // 64 MiB
       timeCost: 3,
       parallelism: 4,
       saltLength: 32
     };
   
     async hashPassword(password: string): Promise<string> {
       // Generate a unique salt for each password
       const salt = randomBytes(32);
       return argon2.hash(password, {
         ...this.argonOptions,
         salt
       });
     }
   
     async verifyPassword(password: string, hash: string): Promise<boolean> {
       try {
         return await argon2.verify(hash, password);
       } catch {
         return false;
       }
     }
     
     async needsRehash(hash: string): Promise<boolean> {
       return argon2.needsRehash(hash, this.argonOptions);
     }
   
     validatePasswordStrength(password: string): {
       valid: boolean;
       errors: string[];
       score: number; // 0-100 strength score
     } {
       // Enhanced password requirements
       type StrongPassword = string & 
         tags.MinLength<12> & // NIST recommends 12+
         tags.MaxLength<128> &
         tags.Pattern<"^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).*$">;
       
       const validate = typia.createValidate<StrongPassword>();
       const result = validate(password);
       
       // Calculate strength score
       let score = 0;
       if (password.length >= 12) score += 25;
       if (password.length >= 16) score += 15;
       if (/[a-z]/.test(password)) score += 15;
       if (/[A-Z]/.test(password)) score += 15;
       if (/[0-9]/.test(password)) score += 15;
       if (/[^a-zA-Z0-9]/.test(password)) score += 15;
       
       return {
         valid: result.success,
         errors: result.success ? [] : [
           'Password must be at least 12 characters',
           'Include uppercase, lowercase, numbers, and symbols'
         ],
         score
       };
     }
   }
   ```

5. **Create auth decorators** (`/packages/auth/src/decorators/index.ts`):
   ```typescript
   import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
   
   // Get current user from request
   export const CurrentUser = createParamDecorator(
     (data: unknown, ctx: ExecutionContext) => {
       const request = ctx.switchToHttp().getRequest();
       return request.user;
     }
   );
   
   // Set required roles for endpoint
   export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
   
   // Mark endpoint as public (no auth required)
   export const Public = () => SetMetadata('isPublic', true);
   
   // Require specific project membership
   export const RequireProject = () => SetMetadata('requireProject', true);
   ```

6. **Create role guard** (`/packages/auth/src/guards/roles.guard.ts`):
   ```typescript
   import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
   import { Reflector } from '@nestjs/core';
   import { prisma } from '@nelo/db';
   
   @Injectable()
   export class RolesGuard implements CanActivate {
     constructor(private reflector: Reflector) {}
   
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
         context.getHandler(),
         context.getClass(),
       ]);
       
       if (!requiredRoles) {
         return true;
       }
       
       const request = context.switchToHttp().getRequest();
       const user = request.user;
       
       if (!user) {
         return false;
       }
       
       // Check if user has required role in the project
       if (request.params.projectId) {
         const membership = await prisma.projectMember.findUnique({
           where: {
             projectId_userId: {
               projectId: request.params.projectId,
               userId: user.id
             }
           }
         });
         
         if (!membership) {
           return false;
         }
         
         return requiredRoles.includes(membership.role);
       }
       
       // Global admin check could go here
       return false;
     }
   }
   ```

7. **Create JWT auth guard** (`/packages/auth/src/guards/jwt.guard.ts`):
   ```typescript
   import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
   import { Reflector } from '@nestjs/core';
   import { JwtService } from '../utils/jwt';
   
   @Injectable()
   export class JwtAuthGuard implements CanActivate {
     constructor(
       private jwtService: JwtService,
       private reflector: Reflector
     ) {}
   
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
         context.getHandler(),
         context.getClass(),
       ]);
       
       if (isPublic) {
         return true;
       }
       
       const request = context.switchToHttp().getRequest();
       const token = this.extractTokenFromHeader(request);
       
       if (!token) {
         throw new UnauthorizedException('No token provided');
       }
       
       try {
         const payload = await this.jwtService.verifyToken(token);
         request.user = payload;
         return true;
       } catch {
         throw new UnauthorizedException('Invalid token');
       }
     }
   
     private extractTokenFromHeader(request: any): string | undefined {
       const [type, token] = request.headers.authorization?.split(' ') ?? [];
       return type === 'Bearer' ? token : undefined;
     }
   }
   ```

8. **Create auth module** (`/packages/auth/src/auth.module.ts`):
   ```typescript
   import { Module, Global } from '@nestjs/common';
   import { JwtService } from './utils/jwt';
   import { PasswordService } from './utils/password';
   import { JwtAuthGuard } from './guards/jwt.guard';
   import { RolesGuard } from './guards/roles.guard';
   
   @Global()
   @Module({
     providers: [
       {
         provide: JwtService,
         useFactory: () => {
           const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
           return new JwtService(secret);
         }
       },
       PasswordService,
       JwtAuthGuard,
       RolesGuard
     ],
     exports: [
       JwtService,
       PasswordService,
       JwtAuthGuard,
       RolesGuard
     ]
   })
   export class AuthModule {}
   ```

9. **Create main export** (`/packages/auth/src/index.ts`):
   ```typescript
   // Utils
   export { JwtService, JwtPayload } from './utils/jwt';
   export { PasswordService } from './utils/password';
   
   // Guards
   export { JwtAuthGuard } from './guards/jwt.guard';
   export { RolesGuard } from './guards/roles.guard';
   
   // Decorators
   export { CurrentUser, Roles, Public, RequireProject } from './decorators';
   
   // Module
   export { AuthModule } from './auth.module';
   ```

## Testing Requirements

1. **JWT tests** (`/packages/auth/test/jwt.test.ts`):
   - Test token generation and verification
   - Test refresh token rotation
   - Test token blacklisting
   - Test expired tokens
   - Test invalid tokens
   - Test JWT replay attacks

2. **Password tests** (`/packages/auth/test/password.test.ts`):
   - Test argon2 hashing
   - Test password verification
   - Test password strength validation
   - Test rehashing detection
   - Benchmark hashing performance
   - Test timing attack resistance

3. **Guard tests** (`/packages/auth/test/guards.test.ts`):
   - Test role-based access control
   - Test project-level permissions
   - Test public endpoints
   - Test missing/invalid auth
   - Test rate limiting
   - Test CSRF protection

Example test:
```typescript
describe('JwtService', () => {
  const service = new JwtService('test-secret-min-32-chars-for-security');
  
  it('should generate and verify token', async () => {
    const payload = { 
      sub: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com'
    };
    const token = service.generateToken(payload);
    const verified = await service.verifyToken(token);
    
    expect(verified.sub).toBe('123');
    expect(verified.email).toBe('test@example.com');
  });
});
```

## Files to Modify/Create
- `/packages/auth/package.json` - Create new
- `/packages/auth/tsconfig.json` - Create new
- `/packages/auth/src/index.ts` - Main export
- `/packages/auth/src/utils/jwt.ts` - JWT utilities
- `/packages/auth/src/utils/password.ts` - Password utilities
- `/packages/auth/src/decorators/index.ts` - Auth decorators
- `/packages/auth/src/guards/jwt.guard.ts` - JWT guard
- `/packages/auth/src/guards/roles.guard.ts` - Role guard
- `/packages/auth/src/auth.module.ts` - NestJS module
- `/packages/auth/test/*.test.ts` - Test files

## Validation Commands
```bash
# From project root
cd packages/auth

# Install dependencies
pnpm install

# Run tests
pnpm test

# Check types
pnpm typecheck

# Verify exports work
node -e "const auth = require('./src'); console.log(Object.keys(auth));"
```

## Notes
- JWT secret MUST be at least 256 bits (32 characters) in production
- Use environment variables for all secrets
- Implement rate limiting: 5 login attempts per minute per IP
- Session management requires Redis for production
- Consider implementing:
  - OAuth 2.0 providers (Google, GitHub, etc.)
  - WebAuthn/Passkeys support
  - Magic link authentication
  - Two-factor authentication (TOTP)
  - Account lockout after failed attempts
- Security headers should include:
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options
  - Content-Security-Policy
- This package will be used by the Authentication & Access ticket (01-core/007)