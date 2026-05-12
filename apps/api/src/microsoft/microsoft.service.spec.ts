import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GraphService } from './graph.service';
import { MicrosoftService } from './microsoft.service';

describe('MicrosoftService', () => {
  let service: MicrosoftService;

  const CLIENT_ID = 'test-client-id-123';
  const REDIRECT_URI = 'http://localhost:3000/microsoft/auth/callback';
  const USER_ID = 'user-uuid-abc';

  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'AZURE_CLIENT_ID') return CLIENT_ID;
      if (key === 'AZURE_REDIRECT_URI') return REDIRECT_URI;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  };

  const parseCookie = (value: string) =>
    JSON.parse(value) as { state: string; userId: string };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MicrosoftService,
        { provide: ConfigService, useValue: config },
        { provide: GraphService, useValue: {} },
      ],
    }).compile();

    service = module.get<MicrosoftService>(MicrosoftService);
  });

  describe('buildConsentUrl', () => {
    it('targets the Microsoft admin-consent endpoint on /common', () => {
      const { url } = service.buildConsentUrl(USER_ID);
      const parsed = new URL(url);

      expect(parsed.protocol).toBe('https:');
      expect(parsed.host).toBe('login.microsoftonline.com');
      expect(parsed.pathname).toBe('/common/adminconsent');
    });

    it('includes client_id, redirect_uri, and state query params matching the cookie state', () => {
      const { url, cookieValue } = service.buildConsentUrl(USER_ID);
      const parsed = new URL(url);
      const payload = parseCookie(cookieValue);

      expect(parsed.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(parsed.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
      expect(parsed.searchParams.get('state')).toBe(payload.state);
    });

    it('reads both Azure env vars via getOrThrow', () => {
      service.buildConsentUrl(USER_ID);
      expect(config.getOrThrow).toHaveBeenCalledWith('AZURE_CLIENT_ID');
      expect(config.getOrThrow).toHaveBeenCalledWith('AZURE_REDIRECT_URI');
    });

    it('returns a cookieValue JSON of {state, userId} with base64url-shaped state', () => {
      const { cookieValue } = service.buildConsentUrl(USER_ID);
      const payload = parseCookie(cookieValue);

      expect(payload.userId).toBe(USER_ID);
      expect(payload.state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(payload.state.length).toBeGreaterThanOrEqual(40);
    });

    it('produces a different state and url on each call', () => {
      const first = service.buildConsentUrl(USER_ID);
      const second = service.buildConsentUrl(USER_ID);
      const s1 = parseCookie(first.cookieValue).state;
      const s2 = parseCookie(second.cookieValue).state;

      expect(s1).not.toBe(s2);
      expect(first.url).not.toBe(second.url);
    });

    it('URL-encodes the redirect_uri inside the query string', () => {
      const { url } = service.buildConsentUrl(USER_ID);
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fmicrosoft%2Fauth%2Fcallback',
      );
    });
  });

  describe('verifyStateCookie', () => {
    const makeCookie = (state: string, userId = USER_ID) =>
      JSON.stringify({ state, userId });

    const expectStateMismatch = (fn: () => unknown) => {
      try {
        fn();
        fail('expected OAUTH_STATE_MISMATCH to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(400);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'OAUTH_STATE_MISMATCH',
        });
      }
    };

    it('returns userId when state matches', () => {
      const cookie = makeCookie('abc123');
      expect(service.verifyStateCookie(cookie, 'abc123')).toEqual({
        userId: USER_ID,
      });
    });

    it('throws when cookie is undefined (missing)', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(undefined, 'anystate'),
      );
    });

    it('throws when cookie is false (tampered signed cookie)', () => {
      expectStateMismatch(() => service.verifyStateCookie(false, 'anystate'));
    });

    it('throws when cookie is empty string', () => {
      expectStateMismatch(() => service.verifyStateCookie('', 'anystate'));
    });

    it('throws when stateParam is missing', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(makeCookie('abc'), undefined),
      );
    });

    it('throws when cookie is not valid JSON', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie('not-json', 'anystate'),
      );
    });

    it('throws when parsed cookie is not an object', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie('"just-a-string"', 'anystate'),
      );
    });

    it('throws when state field is missing', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(
          JSON.stringify({ userId: USER_ID }),
          'anystate',
        ),
      );
    });

    it('throws when userId field is missing', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(JSON.stringify({ state: 'abc' }), 'abc'),
      );
    });

    it('throws when states differ', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(makeCookie('abc'), 'xyz'),
      );
    });

    it('throws when states are different lengths', () => {
      expectStateMismatch(() =>
        service.verifyStateCookie(makeCookie('abc'), 'abcd'),
      );
    });
  });
});
