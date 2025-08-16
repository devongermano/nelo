# Ticket: 01-core/007 - Authentication & Access Control

## Priority
**Critical** - Security foundation for all features

## Spec Reference
`/docs/spec-pack.md` sections:
- Auth & Tenancy (line 4)
- User, Team, Membership models (lines 556-581)
- Role enum: OWNER|MAINTAINER|WRITER|READER (line 275)

## Dependencies
- 00-structural/000 (Complete Typia Setup)
- 00-structural/004 (Auth Package Setup)

## Current State
- Auth package created but not integrated
- No user registration/login endpoints
- No role checking on endpoints
- No JWT validation

## Target State
- User registration and login working
- JWT authentication on all endpoints
- Role-based access control
- Project membership checking

## Acceptance Criteria
- [ ] User can register with email/password
- [ ] User can login and receive JWT
- [ ] Protected endpoints require valid JWT
- [ ] Role-based guards work correctly
- [ ] Project membership verified
- [ ] Tests cover auth flows

## 🔒 Enhanced Security Implementation

### Critical Security Improvements:
1. **Argon2id**: Memory-hard password hashing
2. **httpOnly Cookies**: JWT storage (not localStorage)
3. **CSRF Protection**: Double-submit cookies
4. **Rate Limiting**: Prevent brute force attacks
5. **Account Lockout**: After failed attempts
6. **Email Verification**: Required for new accounts
7. **2FA Support**: TOTP authentication
8. **Session Management**: Secure refresh tokens

## Implementation Steps

1. **Install Security Dependencies**
   ```json
   {
     "dependencies": {
       "argon2": "^0.31.0",
       "@nestjs/throttler": "^5.0.0",
       "@nestjs/jwt": "^10.0.0",
       "@nestjs/passport": "^10.0.0",
       "passport-jwt": "^4.0.0",
       "speakeasy": "^2.0.0",
       "qrcode": "^1.5.0",
       "helmet": "^7.0.0",
       "express-rate-limit": "^7.0.0",
       "ioredis": "^5.3.0"
     }
   }
   ```

2. **Create Secure Auth DTOs** (`/apps/api/src/auth/dto/`):
   ```typescript
   import { tags } from 'typia';
   
   export interface RegisterDto {
     email: string & tags.Format<"email">;
     // ENHANCED: Stronger password requirements
     password: string & tags.MinLength<12> & tags.MaxLength<128> & 
       tags.Pattern<"^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).*$">;
     captchaToken?: string; // For bot prevention
     displayName?: string & tags.MaxLength<100>;
   }
   
   export interface LoginDto {
     email: string & tags.Format<"email">;
     password: string;
   }
   ```

3. **Enhanced Auth Service** (`/apps/api/src/auth/auth.service.ts`):
   ```typescript
   import * as argon2 from 'argon2';
   import { JwtService } from '@nestjs/jwt';
   import * as speakeasy from 'speakeasy';
   import * as crypto from 'crypto';
   
   @Injectable()
   export class AuthService {
     private readonly MAX_LOGIN_ATTEMPTS = 5;
     private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
     
     constructor(
       private jwtService: JwtService,
       private redis: Redis,
       private emailService: EmailService
     ) {}
     
     async register(dto: RegisterDto) {
       // Check if user exists
       const existing = await prisma.user.findUnique({
         where: { email: dto.email }
       });
       
       if (existing) {
         throw new ConflictException('Email already registered');
       }
       
       // SECURITY: Hash with Argon2id (memory-hard, side-channel resistant)
       const hashedPassword = await argon2.hash(dto.password, {
         type: argon2.argon2id,
         memoryCost: 65536, // 64 MB
         timeCost: 3,
         parallelism: 4,
         saltLength: 32
       });
       
       // Create user with email verification token
       const emailVerificationToken = crypto.randomBytes(32).toString('hex');
       
       const user = await prisma.user.create({
         data: {
           email: dto.email,
           password: hashedPassword,
           displayName: dto.displayName,
           emailVerified: false,
           emailVerificationToken,
           createdAt: new Date()
         }
       });
       
       // Send verification email
       await this.emailService.sendVerificationEmail(
         dto.email,
         emailVerificationToken
       );
       
       // SECURITY: Use different secrets for access and refresh tokens
       const accessToken = this.jwtService.sign(
         {
           sub: user.id,
           email: user.email,
           type: 'access'
         },
         {
           secret: process.env.JWT_ACCESS_SECRET,
           expiresIn: '15m' // Short-lived
         }
       );
       
       const refreshToken = this.jwtService.sign(
         {
           sub: user.id,
           type: 'refresh',
           tokenFamily: crypto.randomUUID() // For refresh token rotation
         },
         {
           secret: process.env.JWT_REFRESH_SECRET,
           expiresIn: '7d'
         }
       );
       
       // Store refresh token in Redis with family tracking
       await this.redis.setex(
         `refresh:${user.id}:${refreshToken}`,
         7 * 24 * 60 * 60,
         JSON.stringify({ tokenFamily: refreshToken })
       );
       
       return {
         user: { id: user.id, email: user.email },
         accessToken,
         refreshToken
       };
     }
     
     async login(dto: LoginDto, ipAddress: string) {
       // Check account lockout
       const lockoutKey = `lockout:${dto.email}`;
       const lockout = await this.redis.get(lockoutKey);
       
       if (lockout) {
         throw new ForbiddenException('Account temporarily locked. Try again later.');
       }
       
       // Check login attempts
       const attemptsKey = `attempts:${dto.email}`;
       const attempts = parseInt(await this.redis.get(attemptsKey) || '0');
       
       if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
         // Lock account
         await this.redis.setex(lockoutKey, this.LOCKOUT_DURATION / 1000, 'locked');
         await this.redis.del(attemptsKey);
         throw new ForbiddenException('Too many failed attempts. Account locked.');
       }
       
       const user = await prisma.user.findUnique({
         where: { email: dto.email },
         select: {
           id: true,
           email: true,
           password: true,
           emailVerified: true,
           twoFactorEnabled: true,
           twoFactorSecret: true
         }
       });
       
       if (!user) {
         // Increment attempts even for non-existent users (prevent enumeration)
         await this.redis.incr(attemptsKey);
         await this.redis.expire(attemptsKey, 900); // 15 minutes
         throw new UnauthorizedException('Invalid credentials');
       }
       
       // Verify password with Argon2
       const valid = await argon2.verify(user.password, dto.password);
       
       if (!valid) {
         await this.redis.incr(attemptsKey);
         await this.redis.expire(attemptsKey, 900);
         throw new UnauthorizedException('Invalid credentials');
       }
       
       // Check email verification
       if (!user.emailVerified) {
         throw new UnauthorizedException('Please verify your email first');
       }
       
       // Clear login attempts on success
       await this.redis.del(attemptsKey);
       
       // Check 2FA if enabled
       if (user.twoFactorEnabled) {
         // Return partial token requiring 2FA
         const pendingToken = this.jwtService.sign(
           {
             sub: user.id,
             type: '2fa-pending'
           },
           {
             secret: process.env.JWT_2FA_SECRET,
             expiresIn: '5m'
           }
         );
         
         return {
           requiresTwoFactor: true,
           pendingToken
         };
       }
       
       const accessToken = this.jwtService.generateToken({
         sub: user.id,
         email: user.email
       });
       
       const refreshToken = this.jwtService.generateRefreshToken(user.id);
       
       return {
         user: { id: user.id, email: user.email },
         accessToken,
         refreshToken
       };
     }
     
     async refresh(refreshToken: string) {
       const payload = this.jwtService.verifyToken(refreshToken);
       
       const user = await prisma.user.findUnique({
         where: { id: payload.sub }
       });
       
       if (!user) {
         throw new UnauthorizedException('Invalid token');
       }
       
       const accessToken = this.jwtService.generateToken({
         sub: user.id,
         email: user.email
       });
       
       return { accessToken };
     }
   }
   ```

4. **Secure Auth Controller** (`/apps/api/src/auth/auth.controller.ts`):
   ```typescript
   import { TypedBody, TypedRoute } from '@nestia/core';
   import { Controller, Res, Req, UseGuards, Ip } from '@nestjs/common';
   import { Response, Request } from 'express';
   import { Throttle } from '@nestjs/throttler';
   
   @Controller('auth')
   export class AuthController {
     constructor(private authService: AuthService) {}
     
     @Public()
     @TypedRoute.Post('register')
     @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
     async register(
       @TypedBody() dto: RegisterDto,
       @Res({ passthrough: true }) res: Response
     ) {
       const result = await this.authService.register(dto);
       
       // SECURITY: Set httpOnly cookie for refresh token
       res.cookie('refreshToken', result.refreshToken, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
         path: '/auth/refresh'
       });
       
       // Don't send refresh token in response body
       return {
         user: result.user,
         accessToken: result.accessToken
       };
     }
     
     @Public()
     @TypedRoute.Post('login')
     @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
     async login(
       @TypedBody() dto: LoginDto,
       @Ip() ipAddress: string,
       @Res({ passthrough: true }) res: Response
     ) {
       const result = await this.authService.login(dto, ipAddress);
       
       if (result.requiresTwoFactor) {
         return result; // Return pending token for 2FA
       }
       
       // Set secure cookies
       res.cookie('refreshToken', result.refreshToken, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 7 * 24 * 60 * 60 * 1000,
         path: '/auth/refresh'
       });
       
       // Set CSRF token in separate cookie
       const csrfToken = crypto.randomBytes(32).toString('hex');
       res.cookie('csrfToken', csrfToken, {
         httpOnly: false, // Needs to be readable by JS
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict'
       });
       
       return {
         user: result.user,
         accessToken: result.accessToken,
         csrfToken
       };
     }
     
     @Public()
     @Post('refresh')
     @Throttle({ default: { limit: 10, ttl: 60000 } })
     async refresh(
       @Req() req: Request,
       @Res({ passthrough: true }) res: Response
     ) {
       // Get refresh token from httpOnly cookie
       const refreshToken = req.cookies?.refreshToken;
       
       if (!refreshToken) {
         throw new UnauthorizedException('No refresh token');
       }
       
       // Verify CSRF token
       const csrfToken = req.headers['x-csrf-token'];
       const cookieCsrf = req.cookies?.csrfToken;
       
       if (!csrfToken || csrfToken !== cookieCsrf) {
         throw new ForbiddenException('CSRF token mismatch');
       }
       
       const result = await this.authService.refreshWithRotation(refreshToken);
       
       // Rotate refresh token
       res.cookie('refreshToken', result.refreshToken, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 7 * 24 * 60 * 60 * 1000,
         path: '/auth/refresh'
       });
       
       return {
         accessToken: result.accessToken
       };
     }
     
     @Get('me')
     async getMe(@CurrentUser() user: any) {
       return prisma.user.findUnique({
         where: { id: user.sub },
         select: {
           id: true,
           email: true,
           displayName: true,
           memberships: {
             include: { project: true }
           }
         }
       });
     }
   }
   ```

5. **Add 2FA Support** (`/apps/api/src/auth/auth.service.ts` addition):
   ```typescript
   async setup2FA(userId: string) {
     const secret = speakeasy.generateSecret({
       name: `Nelo (${userId})`,
       length: 32
     });
     
     // Store secret temporarily
     await this.redis.setex(
       `2fa-setup:${userId}`,
       300, // 5 minutes to complete setup
       secret.base32
     );
     
     // Generate QR code
     const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
     
     return {
       secret: secret.base32,
       qrCode
     };
   }
   
   async verify2FA(userId: string, token: string, isSetup: boolean = false) {
     let secret: string;
     
     if (isSetup) {
       // Get from temporary storage
       secret = await this.redis.get(`2fa-setup:${userId}`);
       if (!secret) {
         throw new BadRequestException('2FA setup expired');
       }
     } else {
       // Get from database
       const user = await prisma.user.findUnique({
         where: { id: userId },
         select: { twoFactorSecret: true }
       });
       secret = user?.twoFactorSecret;
     }
     
     if (!secret) {
       throw new BadRequestException('2FA not configured');
     }
     
     const verified = speakeasy.totp.verify({
       secret,
       encoding: 'base32',
       token,
       window: 1 // Allow 1 step before/after
     });
     
     if (verified && isSetup) {
       // Save secret to database
       await prisma.user.update({
         where: { id: userId },
         data: {
           twoFactorEnabled: true,
           twoFactorSecret: secret
         }
       });
       
       await this.redis.del(`2fa-setup:${userId}`);
     }
     
     return verified;
   }
   ```

6. **Enhanced Project Access Guard** (`/apps/api/src/auth/guards/project-access.guard.ts`):
   ```typescript
   @Injectable()
   export class ProjectAccessGuard implements CanActivate {
     constructor(private reflector: Reflector) {}
     
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
       const request = context.switchToHttp().getRequest();
       const user = request.user;
       const projectId = request.params.projectId || request.body.projectId;
       
       if (!projectId) return true;
       
       const membership = await prisma.projectMember.findUnique({
         where: {
           projectId_userId: {
             projectId,
             userId: user.sub
           }
         }
       });
       
       if (!membership) return false;
       
       if (!requiredRoles) return true;
       
       return this.hasRequiredRole(membership.role, requiredRoles);
     }
     
     private hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
       const roleHierarchy = {
         OWNER: 4,
         MAINTAINER: 3,
         WRITER: 2,
         READER: 1
       };
       
       const userLevel = roleHierarchy[userRole] || 0;
       const requiredLevel = Math.min(...requiredRoles.map(r => roleHierarchy[r] || 0));
       
       return userLevel >= requiredLevel;
     }
   }
   ```

5. **Update AppModule** (`/apps/api/src/app.module.ts`):
   ```typescript
   import { APP_GUARD } from '@nestjs/core';
   import { JwtAuthGuard, AuthModule } from '@nelo/auth';
   
   @Module({
     imports: [
       AuthModule,
       // ... other modules
     ],
     providers: [
       {
         provide: APP_GUARD,
         useClass: JwtAuthGuard // Global auth
       },
       {
         provide: APP_GUARD,
         useClass: ProjectAccessGuard // Project access
       }
     ]
   })
   export class AppModule {}
   ```

6. **Protect endpoints with roles**:
   ```typescript
   @Controller('projects/:projectId/scenes')
   export class ScenesController {
     @Post()
     @Roles('WRITER', 'MAINTAINER', 'OWNER')
     async create() { /* ... */ }
     
     @Get()
     @Roles('READER', 'WRITER', 'MAINTAINER', 'OWNER')
     async list() { /* ... */ }
     
     @Delete(':id')
     @Roles('MAINTAINER', 'OWNER')
     async delete() { /* ... */ }
   }
   ```

## Testing Requirements
- Test registration flow
- Test login with correct/incorrect credentials
- Test JWT validation
- Test role hierarchy
- Test project access control

## Files to Modify/Create
- `/apps/api/src/auth/` - Auth module
- `/apps/api/src/auth/auth.service.ts`
- `/apps/api/src/auth/auth.controller.ts`
- `/apps/api/src/auth/guards/project-access.guard.ts`
- `/apps/api/src/app.module.ts` - Add guards
- Update all controllers with @Roles decorators
- Test files

## Validation Commands
```bash
cd apps/api
pnpm test auth

# Test registration
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Test login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

## Notes
- Store refresh tokens securely
- Consider adding OAuth providers later
- Implement password reset flow
- Add rate limiting on auth endpoints