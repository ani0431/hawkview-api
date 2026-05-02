import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const auth = {
    register: jest.fn(),
    login: jest.fn(),
    signAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register returns contract shape and sets httpOnly cookie', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'admin' };
    auth.register.mockResolvedValue(user);
    auth.signAccessToken.mockReturnValue('jwt-token');

    const res = { cookie: jest.fn() } as unknown as Response;
    const body = await controller.register(
      { email: 'a@b.com', password: 'password123' },
      res,
    );

    expect(body).toEqual({ success: true, data: { user } });
    expect(auth.signAccessToken).toHaveBeenCalledWith(user);
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'jwt-token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('login returns contract shape and sets cookie', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'admin' };
    auth.login.mockResolvedValue(user);
    auth.signAccessToken.mockReturnValue('jwt-token');

    const res = { cookie: jest.fn() } as unknown as Response;
    const body = await controller.login(
      { email: 'a@b.com', password: 'x' },
      res,
    );

    expect(body).toEqual({ success: true, data: { user } });
    expect(res.cookie).toHaveBeenCalled();
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

  it('logout clears cookie and returns loggedOut', () => {
    const res = { clearCookie: jest.fn() } as unknown as Response;
    const body = controller.logout(res);

    expect(body).toEqual({ success: true, data: { loggedOut: true } });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'access_token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});
