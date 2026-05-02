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
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto);
    const token = this.auth.signAccessToken(user);
    this.setAuthCookie(res, token);
    return { success: true, data: { user } };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(dto);
    const token = this.auth.signAccessToken(user);
    this.setAuthCookie(res, token);
    return { success: true, data: { user } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @Req()
    req: Request & {
      user: { id: string; email: string; role: string };
    },
  ) {
    const u = req.user;
    return {
      success: true,
      data: { user: { id: u.id, email: u.email, role: u.role } },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    return { success: true, data: { loggedOut: true } };
  }

  private setAuthCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookie(res: Response): void {
    const secure = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
}
