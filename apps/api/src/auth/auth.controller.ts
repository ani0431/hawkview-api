import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE_PATH = '/';
const REFRESH_COOKIE_PATH = '/auth';
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

type AuthedRequest = Request & {
  user: PublicUser;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register a new user and open a session',
    description:
      'Creates the user and sets httpOnly `access_token` (15 min, path `/`) and `refresh_token` (7 days, path `/auth`) cookies.',
  })
  @ApiOkResponse({ description: 'User created and session cookies set.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto);
    await this.issueSession(res, user);
    return { success: true, data: { user } };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Log in and open a session',
    description:
      'Verifies credentials and sets httpOnly `access_token` + `refresh_token` cookies. Logging in on a new device invalidates the previous refresh token (single-session).',
  })
  @ApiOkResponse({ description: 'Credentials valid, session cookies set.' })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(dto);
    await this.issueSession(res, user);
    return { success: true, data: { user } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiOkResponse({ description: 'Returns the current user.' })
  @ApiUnauthorizedResponse({
    description: 'UNAUTHORIZED — access token missing, invalid, or expired.',
  })
  me(@Req() req: AuthedRequest) {
    const u = req.user;
    return {
      success: true,
      data: { user: { id: u.id, email: u.email, role: u.role } },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
    description:
      'Requires the `refresh_token` cookie. Rotates the opaque refresh token in the DB (new hash, new expiry) and sets fresh `access_token` + `refresh_token` cookies.',
  })
  @ApiOkResponse({ description: 'Cookies rotated.' })
  @ApiUnauthorizedResponse({
    description: 'INVALID_REFRESH_TOKEN — cookie is missing, unknown, or expired.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = this.readRefreshCookie(req);
    const rotated = await this.auth.rotateRefreshToken(raw);
    this.setAccessCookie(res, this.auth.signAccessToken(rotated.user));
    this.setRefreshCookie(res, rotated.raw);
    return { success: true, data: { user: rotated.user } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End the current session',
    description:
      'Idempotent. Deletes the refresh token row (if the cookie is present) and clears both auth cookies on the response.',
  })
  @ApiOkResponse({ description: 'Session ended and cookies cleared.' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = this.readRefreshCookie(req);
    if (raw) {
      await this.auth.revokeRefreshTokenByRaw(raw);
    }
    this.clearAuthCookies(res);
    return { success: true, data: { loggedOut: true } };
  }

  private async issueSession(res: Response, user: PublicUser): Promise<void> {
    this.setAccessCookie(res, this.auth.signAccessToken(user));
    const refresh = await this.auth.issueRefreshToken(user.id);
    this.setRefreshCookie(res, refresh.raw);
  }

  private setAccessCookie(res: Response, token: string): void {
    res.cookie(ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: ACCESS_COOKIE_PATH,
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    });
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.auth.getRefreshCookieMaxAgeMs(),
    });
  }

  private clearAuthCookies(res: Response): void {
    const secure = this.isProduction();
    res.clearCookie(ACCESS_COOKIE, {
      path: ACCESS_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
    res.clearCookie(REFRESH_COOKIE, {
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }

  private readRefreshCookie(req: Request): string {
    const raw = req?.cookies?.[REFRESH_COOKIE];
    return typeof raw === 'string' ? raw : '';
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
