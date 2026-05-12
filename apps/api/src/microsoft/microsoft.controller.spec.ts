import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { TenantsService } from '../tenants/tenants.service';
import { MicrosoftController } from './microsoft.controller';
import { MicrosoftService } from './microsoft.service';

describe('MicrosoftController', () => {
  let controller: MicrosoftController;

  const microsoft = {
    buildConsentUrl: jest.fn(),
    verifyStateCookie: jest.fn(),
  };
  const tenants = {
    connectTenant: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'test' : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MicrosoftController],
      providers: [
        { provide: MicrosoftService, useValue: microsoft },
        { provide: TenantsService, useValue: tenants },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get<MicrosoftController>(MicrosoftController);
  });

  describe('getAuthUrl', () => {
    it('writes the service-provided cookieValue and returns the url', () => {
      microsoft.buildConsentUrl.mockReturnValue({
        url: 'https://login.microsoftonline.com/common/adminconsent?x=1',
        cookieValue: '{"state":"s1","userId":"u1"}',
      });

      const req = {
        user: { id: 'u1', email: 'a@b.com', role: 'admin' },
      } as Request & { user: { id: string; email: string; role: string } };
      const res = { cookie: jest.fn() } as unknown as Response;

      const body = controller.getAuthUrl(
        req as Parameters<typeof controller.getAuthUrl>[0],
        res,
      );

      expect(microsoft.buildConsentUrl).toHaveBeenCalledWith('u1');
      expect(body).toEqual({
        success: true,
        data: { url: 'https://login.microsoftonline.com/common/adminconsent?x=1' },
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'oauth_state',
        '{"state":"s1","userId":"u1"}',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          signed: true,
          path: '/microsoft',
          maxAge: 10 * 60 * 1000,
        }),
      );
    });
  });

  describe('handleCallback', () => {
    const okQuery = {
      admin_consent: 'True',
      tenant: 'ms-tenant-guid',
      state: 'state-from-ms',
    };

    it('happy path: verifies state, connects tenant, clears cookie, returns tenantId', async () => {
      microsoft.verifyStateCookie.mockReturnValue({ userId: 'u1' });
      tenants.connectTenant.mockResolvedValue({ id: 'tenant-1' });

      const req = {
        signedCookies: { oauth_state: '{"state":"state-from-ms","userId":"u1"}' },
      } as unknown as Request;
      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const body = await controller.handleCallback(okQuery, req, res);

      expect(microsoft.verifyStateCookie).toHaveBeenCalledWith(
        '{"state":"state-from-ms","userId":"u1"}',
        'state-from-ms',
      );
      expect(tenants.connectTenant).toHaveBeenCalledWith({
        userId: 'u1',
        microsoftTenantId: 'ms-tenant-guid',
        displayName: 'ms-tenant-guid',
      });
      expect(res.clearCookie).toHaveBeenCalledWith(
        'oauth_state',
        expect.objectContaining({ path: '/microsoft' }),
      );
      expect(body).toEqual({ success: true, data: { tenantId: 'tenant-1' } });
    });

    it('throws OAUTH_CONSENT_DENIED when admin_consent is not "True"', async () => {
      const req = { signedCookies: {} } as unknown as Request;
      const res = { clearCookie: jest.fn() } as unknown as Response;

      try {
        await controller.handleCallback(
          { ...okQuery, admin_consent: 'False' },
          req,
          res,
        );
        fail('expected OAUTH_CONSENT_DENIED');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(400);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'OAUTH_CONSENT_DENIED',
        });
      }
      expect(microsoft.verifyStateCookie).not.toHaveBeenCalled();
      expect(tenants.connectTenant).not.toHaveBeenCalled();
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('bubbles OAUTH_STATE_MISMATCH from the service when cookie is missing', async () => {
      microsoft.verifyStateCookie.mockImplementation(() => {
        throw new HttpException(
          { code: 'OAUTH_STATE_MISMATCH', message: 'x' },
          400,
        );
      });

      const req = { signedCookies: {} } as unknown as Request;
      const res = { clearCookie: jest.fn() } as unknown as Response;

      await expect(
        controller.handleCallback(okQuery, req, res),
      ).rejects.toMatchObject({
        response: { code: 'OAUTH_STATE_MISMATCH' },
      });
      expect(tenants.connectTenant).not.toHaveBeenCalled();
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('does not clear the cookie when connectTenant fails (e.g. TENANT_ALREADY_CONNECTED)', async () => {
      microsoft.verifyStateCookie.mockReturnValue({ userId: 'u1' });
      tenants.connectTenant.mockRejectedValue(
        new HttpException(
          { code: 'TENANT_ALREADY_CONNECTED', message: 'x' },
          409,
        ),
      );

      const req = {
        signedCookies: { oauth_state: 'cookie' },
      } as unknown as Request;
      const res = { clearCookie: jest.fn() } as unknown as Response;

      await expect(
        controller.handleCallback(okQuery, req, res),
      ).rejects.toMatchObject({
        response: { code: 'TENANT_ALREADY_CONNECTED' },
      });
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });
});
