import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const auth = {
    register: jest.fn(),
    login: jest.fn(),
    signAccessToken: jest.fn(),
    issueRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeRefreshTokenByRaw: jest.fn(),
    getRefreshCookieMaxAgeMs: jest.fn(() => 7 * 24 * 60 * 60 * 1000),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? 'test' : undefined,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    auth.getRefreshCookieMaxAgeMs.mockReturnValue(7 * 24 * 60 * 60 * 1000);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register returns contract shape and sets BOTH httpOnly cookies', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'admin' };
    auth.register.mockResolvedValue(user);
    auth.signAccessToken.mockReturnValue('access-jwt');
    auth.issueRefreshToken.mockResolvedValue({
      raw: 'refresh-raw',
      expiresAt: new Date(Date.now() + 1000),
    });

    const res = { cookie: jest.fn() } as unknown as Response;
    const body = await controller.register(
      { email: 'a@b.com', password: 'password123' },
      res,
    );

    expect(body).toEqual({ success: true, data: { user } });
    expect(auth.signAccessToken).toHaveBeenCalledWith(user);
    expect(auth.issueRefreshToken).toHaveBeenCalledWith('u1');
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'access-jwt',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 15 * 60 * 1000 }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-raw',
      expect.objectContaining({
        httpOnly: true,
        path: '/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it('login sets both cookies', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'admin' };
    auth.login.mockResolvedValue(user);
    auth.signAccessToken.mockReturnValue('access-jwt');
    auth.issueRefreshToken.mockResolvedValue({
      raw: 'refresh-raw',
      expiresAt: new Date(Date.now() + 1000),
    });

    const res = { cookie: jest.fn() } as unknown as Response;
    const body = await controller.login(
      { email: 'a@b.com', password: 'x' },
      res,
    );

    expect(body).toEqual({ success: true, data: { user } });
    expect((res.cookie as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      'access_token',
      'refresh_token',
    ]);
  });

  it('me returns user from request', () => {
    const req = {
      user: { id: 'u1', email: 'a@b.com', role: 'admin' },
    } as Request & { user: { id: string; email: string; role: string } };

    expect(controller.me(req)).toEqual({
      success: true,
      data: { user: { id: 'u1', email: 'a@b.com', role: 'admin' } },
    });
  });

  it('refresh rotates token and sets both cookies', async () => {
    auth.rotateRefreshToken.mockResolvedValue({
      raw: 'new-raw',
      expiresAt: new Date(Date.now() + 1000),
      user: { id: 'u1', email: 'a@b.com', role: 'admin' },
    });
    auth.signAccessToken.mockReturnValue('new-access-jwt');

    const req = { cookies: { refresh_token: 'old-raw' } } as unknown as Request;
    const res = { cookie: jest.fn() } as unknown as Response;

    const body = await controller.refresh(req, res);

    expect(auth.rotateRefreshToken).toHaveBeenCalledWith('old-raw');
    expect(body).toEqual({
      success: true,
      data: { user: { id: 'u1', email: 'a@b.com', role: 'admin' } },
    });
    expect((res.cookie as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      'access_token',
      'refresh_token',
    ]);
  });

  it('refresh with no cookie still calls rotate (service throws INVALID_REFRESH_TOKEN)', async () => {
    auth.rotateRefreshToken.mockRejectedValue(new Error('INVALID_REFRESH_TOKEN'));
    const req = { cookies: {} } as unknown as Request;
    const res = { cookie: jest.fn() } as unknown as Response;

    await expect(controller.refresh(req, res)).rejects.toBeDefined();
    expect(auth.rotateRefreshToken).toHaveBeenCalledWith('');
  });

  it('logout revokes refresh by raw cookie and clears both cookies', async () => {
    auth.revokeRefreshTokenByRaw.mockResolvedValue(undefined);
    const req = {
      cookies: { refresh_token: 'the-raw' },
    } as unknown as Request;
    const res = { clearCookie: jest.fn() } as unknown as Response;

    const body = await controller.logout(req, res);

    expect(body).toEqual({ success: true, data: { loggedOut: true } });
    expect(auth.revokeRefreshTokenByRaw).toHaveBeenCalledWith('the-raw');
    expect((res.clearCookie as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      'access_token',
      'refresh_token',
    ]);
  });

  it('logout without refresh cookie still clears both cookies (idempotent)', async () => {
    const req = { cookies: {} } as unknown as Request;
    const res = { clearCookie: jest.fn() } as unknown as Response;

    const body = await controller.logout(req, res);

    expect(body).toEqual({ success: true, data: { loggedOut: true } });
    expect(auth.revokeRefreshTokenByRaw).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });
});
