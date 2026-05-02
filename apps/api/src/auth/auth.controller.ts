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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
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
  me(@Req() req: AuthedRequest) {
    const u = req.user;
    return {
      success: true,
      data: { user: { id: u.id, email: u.email, role: u.role } },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
