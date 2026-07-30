import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { SessionResponse } from '@bjff/api-types';
import type { Request, Response } from 'express';

import { ApiError } from '../common/api-error.js';
import { logger } from '../common/logger.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { AuthService } from './auth.service.js';
import { Public } from './session.guard.js';
import { SESSION_COOKIE, SessionStore } from './session.store.js';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const user = await this.auth.authenticate(body.username, body.password);

    this.sessions.prune();
    const sessionId = this.sessions.create(user.userId);

    response.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.cookieSecure,
      maxAge: this.config.sessionTtlMs,
      path: '/',
    });

    // Sin credenciales ni identificador de sesión en el registro (FR-043).
    logger.info('auth_login', { userId: user.userId });

    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    this.sessions.destroy(request.sessionId);
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    logger.info('auth_logout', { userId: request.userId ?? null });
  }

  @Get('session')
  async session(@Req() request: Request): Promise<SessionResponse> {
    const user = request.userId ? await this.auth.findById(request.userId) : null;
    if (!user) throw ApiError.unauthenticated();
    return { user };
  }
}
