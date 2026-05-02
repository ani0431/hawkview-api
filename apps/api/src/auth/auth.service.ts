import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export type PublicUser = {
  id: string;
  email: string;
  role: string;
};

export type IssuedRefreshToken = {
  raw: string;
  expiresAt: Date;
};

export type RotatedRefreshToken = IssuedRefreshToken & {
  user: PublicUser;
};

const DEFAULT_REFRESH_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash, role: 'admin' },
      });
      return this.toPublicUser(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new HttpException(
          {
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'An account with this email already exists.',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw this.invalidCredentials();
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw this.invalidCredentials();
    }
    return this.toPublicUser(user);
  }

  signAccessToken(user: PublicUser): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const raw = this.generateOpaqueToken();
    const tokenHash = this.hashToken(raw);
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.refreshToken.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    return { raw, expiresAt };
  }

  async rotateRefreshToken(rawToken: string): Promise<RotatedRefreshToken> {
    if (!rawToken) {
      throw this.invalidRefreshToken();
    }
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw this.invalidRefreshToken();
    }

    const newRaw = this.generateOpaqueToken();
    const newHash = this.hashToken(newRaw);
    const newExpiresAt = this.computeRefreshExpiry();

    await this.prisma.refreshToken.update({
      where: { userId: record.userId },
      data: { tokenHash: newHash, expiresAt: newExpiresAt },
    });

    return {
      raw: newRaw,
      expiresAt: newExpiresAt,
      user: this.toPublicUser(record.user),
    };
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.delete({ where: { userId } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        return;
      }
      throw e;
    }
  }

  async revokeRefreshTokenByRaw(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    try {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        return;
      }
      throw e;
    }
  }

  getRefreshCookieMaxAgeMs(): number {
    return this.getRefreshTtlDays() * 24 * 60 * 60 * 1000;
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private computeRefreshExpiry(): Date {
    return new Date(Date.now() + this.getRefreshCookieMaxAgeMs());
  }

  private getRefreshTtlDays(): number {
    const raw = this.config.get<string | number>('REFRESH_TOKEN_TTL_DAYS');
    if (raw === undefined || raw === null || raw === '') {
      return DEFAULT_REFRESH_TTL_DAYS;
    }
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_REFRESH_TTL_DAYS;
  }

  private invalidCredentials(): HttpException {
    return new HttpException(
      { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private invalidRefreshToken(): HttpException {
    return new HttpException(
      {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is missing, invalid, or expired.',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
  }): PublicUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
