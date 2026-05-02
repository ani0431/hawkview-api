import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export type PublicUser = {
  id: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
      throw new HttpException(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new HttpException(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        HttpStatus.UNAUTHORIZED,
      );
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

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
  }): PublicUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
