import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';
import { GraphService } from './graph.service';

export type ConsentRequest = {
  url: string;
  cookieValue: string;
};

export type StateCookiePayload = {
  state: string;
  userId: string;
};

const ADMIN_CONSENT_ENDPOINT =
  'https://login.microsoftonline.com/common/adminconsent';

@Injectable()
export class MicrosoftService {
  constructor(
    private readonly config: ConfigService,
    private readonly graph: GraphService,
  ) {}

  buildConsentUrl(userId: string): ConsentRequest {
    const state = randomBytes(32).toString('base64url');
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('AZURE_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('AZURE_REDIRECT_URI'),
      state,
    });
    const payload: StateCookiePayload = { state, userId };
    return {
      url: `${ADMIN_CONSENT_ENDPOINT}?${params.toString()}`,
      cookieValue: JSON.stringify(payload),
    };
  }

  verifyStateCookie(
    rawCookie: unknown,
    stateParam: string | undefined,
  ): { userId: string } {
    if (typeof rawCookie !== 'string' || rawCookie.length === 0) {
      throw this.stateMismatch();
    }
    if (typeof stateParam !== 'string' || stateParam.length === 0) {
      throw this.stateMismatch();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawCookie);
    } catch {
      throw this.stateMismatch();
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw this.stateMismatch();
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.state !== 'string' || obj.state.length === 0) {
      throw this.stateMismatch();
    }
    if (typeof obj.userId !== 'string' || obj.userId.length === 0) {
      throw this.stateMismatch();
    }

    const cookieStateBuf = Buffer.from(obj.state, 'utf8');
    const paramStateBuf = Buffer.from(stateParam, 'utf8');
    if (cookieStateBuf.length !== paramStateBuf.length) {
      throw this.stateMismatch();
    }
    if (!timingSafeEqual(cookieStateBuf, paramStateBuf)) {
      throw this.stateMismatch();
    }

    return { userId: obj.userId };
  }

  private stateMismatch(): HttpException {
    return new HttpException(
      {
        code: 'OAUTH_STATE_MISMATCH',
        message:
          'OAuth state cookie missing, tampered, or does not match the redirect.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
