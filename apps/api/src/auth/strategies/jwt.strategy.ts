import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

function fromAccessTokenCookie(req: Request): string | null {
  const raw = req?.cookies?.access_token;
  return typeof raw === 'string' ? raw : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessTokenCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): {
    id: string;
    email: string;
    role: string;
  } {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
