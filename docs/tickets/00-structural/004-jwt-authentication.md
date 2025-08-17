# Ticket: 00-structural/004 - JWT Authentication Setup

## Priority
**CRITICAL** - Blocks all security features (permissions, rate limiting, audit)

## Spec Reference
- Foundation for all authentication and authorization
- Required by Permission Matrix (ticket 007)
- Enables user context for audit fields

## Dependencies
- 00-structural/001 (Database Schema Update) - Complete ✅

## Current State
- No authentication implementation
- No JWT validation
- No user context extraction
- Guards and decorators reference non-existent auth

## Target State
- JWT-based authentication using Passport
- Refresh token strategy
- User context available in all requests
- Public route decorator for unprotected endpoints
- Secure token storage patterns

## Acceptance Criteria
- [ ] JWT strategy implemented with Passport
- [ ] Login endpoint returns access and refresh tokens
- [ ] Refresh endpoint rotates tokens
- [ ] AuthGuard validates JWT on protected routes
- [ ] @Public() decorator bypasses auth
- [ ] User context extracted and available in requests
- [ ] Token expiry configured (15min access, 7d refresh)
- [ ] Tests cover auth flows and edge cases

## Implementation Steps

### 1. Install Dependencies

```bash
cd apps/api
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs
pnpm add -D @types/passport-jwt @types/bcryptjs
```

### 2. Create Auth Module

Create `/apps/api/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { PrismaClient } from '@nelo/db';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy, PrismaClient],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

### 3. Create JWT Strategy

Create `/apps/api/src/auth/strategies/jwt.strategy.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@nelo/db';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user object to be attached to request
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
```

### 4. Create Refresh Strategy

Create `/apps/api/src/auth/strategies/refresh.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.get('Authorization')?.replace('Bearer ', '');
    
    return {
      ...payload,
      refreshToken,
    };
  }
}
```

### 5. Create Auth Service with Refresh Token Storage

First, add RefreshToken model to schema:
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique // Hashed token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([expiresAt])
}
```

Create `/apps/api/src/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@nelo/db';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAndStoreTokens(user.id, user.email);
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token exists and is valid
    const hashedToken = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.userId !== userId) {
      throw new ForbiddenException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new ForbiddenException('Refresh token expired');
    }

    // Rotate refresh token (delete old, create new)
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.generateAndStoreTokens(storedToken.user.id, storedToken.user.email);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: {
        token: hashedToken,
        userId,
      },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async register(email: string, password: string, name: string): Promise<AuthTokens> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return this.generateAndStoreTokens(user.id, user.email);
  }

  private async generateAndStoreTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // Store hashed refresh token
    const hashedToken = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Clean up expired tokens periodically
    await this.cleanupExpiredTokens(userId);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async cleanupExpiredTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
```

### 6. Create Auth Controller

Create `/apps/api/src/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TypedRoute, TypedBody } from '@nestia/core';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { RefreshGuard } from './guards/refresh.guard';
import { tags } from 'typia';

interface LoginDto {
  email: string & tags.Format<'email'>;
  password: string & tags.MinLength<8>;
}

interface RegisterDto {
  email: string & tags.Format<'email'>;
  password: string & tags.MinLength<8>;
  name: string & tags.MinLength<1>;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @TypedRoute.Post('login')
  async login(@TypedBody() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @TypedRoute.Post('register')
  async register(@TypedBody() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Public()
  @UseGuards(RefreshGuard)
  @Post('refresh')
  async refresh(@Req() req: any) {
    const userId = req.user.sub;
    const refreshToken = req.user.refreshToken;
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Post('logout')
  async logout(@CurrentUser() user: any, @Req() req: any) {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');
    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  async logoutAll(@CurrentUser() user: any) {
    await this.authService.logoutAll(user.id);
    return { message: 'Logged out from all devices' };
  }
}
```

### 7. Create Guards and Decorators

Create `/apps/api/src/auth/guards/jwt.guard.ts`:
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }
}
```

Create `/apps/api/src/auth/decorators/public.decorator.ts`:
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Create `/apps/api/src/auth/decorators/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### 8. Apply Global Auth Guard

Update `/apps/api/src/app.module.ts`:
```typescript
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';

@Module({
  // ... existing imports
  providers: [
    // ... existing providers
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

### 9. Update Environment Variables

Add to `.env`:
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Testing Requirements

### Unit Tests
```typescript
describe('AuthService', () => {
  it('should generate valid JWT tokens', async () => {
    const tokens = await authService.login('test@example.com', 'password');
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    await expect(authService.login('test@example.com', 'wrong'))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should refresh tokens successfully', async () => {
    const newTokens = await authService.refreshTokens(userId, refreshToken);
    expect(newTokens.accessToken).not.toBe(oldAccessToken);
  });
});
```

### E2E Tests
```typescript
describe('Auth Flow', () => {
  it('should complete full auth cycle', async () => {
    // Register
    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'Test' });
    expect(registerRes.body.accessToken).toBeDefined();

    // Login
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'new@example.com', password: 'password123' });
    expect(loginRes.body.accessToken).toBeDefined();

    // Access protected route
    const protectedRes = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(protectedRes.status).toBe(200);

    // Refresh token
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${loginRes.body.refreshToken}`);
    expect(refreshRes.body.accessToken).toBeDefined();
  });
});
```

## Files to Create/Modify
- `/apps/api/src/auth/auth.module.ts` - New auth module
- `/apps/api/src/auth/auth.service.ts` - Auth business logic
- `/apps/api/src/auth/auth.controller.ts` - Auth endpoints
- `/apps/api/src/auth/strategies/jwt.strategy.ts` - JWT validation
- `/apps/api/src/auth/strategies/refresh.strategy.ts` - Refresh token strategy
- `/apps/api/src/auth/guards/jwt.guard.ts` - Global JWT guard
- `/apps/api/src/auth/decorators/public.decorator.ts` - Public route decorator
- `/apps/api/src/auth/decorators/current-user.decorator.ts` - User extraction
- `/apps/api/src/app.module.ts` - Register global guard
- `/apps/api/.env` - Add JWT secrets

## Validation Commands
```bash
# Install dependencies
cd apps/api
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs
pnpm add -D @types/passport-jwt @types/bcryptjs

# Run tests
pnpm test auth

# Test endpoints
# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Access protected route
curl http://localhost:3001/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST http://localhost:3001/auth/refresh \
  -H "Authorization: Bearer YOUR_REFRESH_TOKEN"
```

## Notes
- **Security Enhancements Included**:
  - Refresh tokens stored in database with SHA-256 hashing
  - Refresh token rotation on each refresh (prevents token reuse)
  - Logout and logout-all endpoints for token revocation
  - Automatic cleanup of expired tokens
- **Production Considerations**:
  - Add rate limiting specifically for auth endpoints (see ticket 010)
  - Monitor for brute force attempts
  - Consider 2FA for additional security
  - Add OAuth providers (Google, GitHub) later
  - Implement account lockout after failed attempts
  - Add email verification for registration
- **Performance**:
  - Consider Redis for token blacklist instead of DB
  - Add index on RefreshToken.token for fast lookups
  - Batch delete expired tokens periodically