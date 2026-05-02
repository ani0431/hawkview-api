import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let passwordHash: string;

  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const jwt = { sign: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'REFRESH_TOKEN_TTL_DAYS') return 7;
      return undefined;
    }),
  };

  const sha256 = (raw: string) =>
    createHash('sha256').update(raw).digest('hex');

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('password123', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('register creates user and returns public fields', async () => {
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hidden',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      email: 'A@B.COM',
      password: 'password123',
    });

    expect(result).toEqual({ id: 'u1', email: 'a@b.com', role: 'admin' });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'a@b.com',
        role: 'admin',
      }),
    });
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBeDefined();
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).not.toBe(
      'password123',
    );
  });

  it('register maps unique email to EMAIL_ALREADY_REGISTERED', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.user.create.mockRejectedValue(err);

    try {
      await service.register({ email: 'x@y.com', password: 'password123' });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(409);
      expect((e as HttpException).getResponse()).toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }
  });

  it('login returns user when password matches', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login({
      email: 'a@b.com',
      password: 'password123',
    });

    expect(result).toEqual({ id: 'u1', email: 'a@b.com', role: 'admin' });
  });

  it('login rejects wrong password with INVALID_CREDENTIALS', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: await bcrypt.hash('other', 4),
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await service.login({ email: 'a@b.com', password: 'password123' });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    }
  });

  it('login rejects unknown email with INVALID_CREDENTIALS', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    try {
      await service.login({ email: 'nope@b.com', password: 'password123' });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    }
  });

  it('signAccessToken delegates to JwtService', () => {
    jwt.sign.mockReturnValue('signed');
    const t = service.signAccessToken({
      id: 'u1',
      email: 'a@b.com',
      role: 'admin',
    });
    expect(t).toBe('signed');
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'a@b.com',
      role: 'admin',
    });
  });

  describe('refresh tokens', () => {
    it('issueRefreshToken upserts a hashed row and returns opaque token + expiry', async () => {
      prisma.refreshToken.upsert.mockResolvedValue({});

      const result = await service.issueRefreshToken('u1');

      expect(result.raw).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.raw.length).toBeGreaterThanOrEqual(40);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(prisma.refreshToken.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.refreshToken.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: 'u1' });
      expect(call.create.tokenHash).toBe(sha256(result.raw));
      expect(call.update.tokenHash).toBe(sha256(result.raw));
    });

    it('rotateRefreshToken swaps hash and returns public user on success', async () => {
      prisma.refreshToken.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 'r1',
          userId: 'u1',
          tokenHash: 'whatever',
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 'u1',
            email: 'a@b.com',
            passwordHash: 'x',
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      );
      prisma.refreshToken.update.mockResolvedValue({});

      const result = await service.rotateRefreshToken('old-raw-token');

      expect(result.user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        role: 'admin',
      });
      expect(result.raw).not.toBe('old-raw-token');
      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('old-raw-token') },
        include: { user: true },
      });
      const upd = prisma.refreshToken.update.mock.calls[0][0];
      expect(upd.where).toEqual({ userId: 'u1' });
      expect(upd.data.tokenHash).toBe(sha256(result.raw));
    });

    it('rotateRefreshToken rejects empty token with INVALID_REFRESH_TOKEN', async () => {
      try {
        await service.rotateRefreshToken('');
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(401);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'INVALID_REFRESH_TOKEN',
        });
      }
    });

    it('rotateRefreshToken rejects unknown hash with INVALID_REFRESH_TOKEN', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      try {
        await service.rotateRefreshToken('missing');
        expect(true).toBe(false);
      } catch (e) {
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'INVALID_REFRESH_TOKEN',
        });
      }
    });

    it('rotateRefreshToken rejects expired row with INVALID_REFRESH_TOKEN', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        tokenHash: 'x',
        expiresAt: new Date(Date.now() - 1_000),
        user: {
          id: 'u1',
          email: 'a@b.com',
          passwordHash: 'x',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      try {
        await service.rotateRefreshToken('any');
        expect(true).toBe(false);
      } catch (e) {
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'INVALID_REFRESH_TOKEN',
        });
      }
    });

    it('revokeRefreshToken deletes by userId', async () => {
      prisma.refreshToken.delete.mockResolvedValue({});
      await service.revokeRefreshToken('u1');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    it('revokeRefreshToken is idempotent when row is already gone (P2025)', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      prisma.refreshToken.delete.mockRejectedValue(err);
      await expect(service.revokeRefreshToken('u1')).resolves.toBeUndefined();
    });

    it('revokeRefreshTokenByRaw deletes by hash', async () => {
      prisma.refreshToken.delete.mockResolvedValue({});
      await service.revokeRefreshTokenByRaw('raw');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { tokenHash: sha256('raw') },
      });
    });

    it('revokeRefreshTokenByRaw is a no-op for empty input', async () => {
      await service.revokeRefreshTokenByRaw('');
      expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
    });

    it('getRefreshCookieMaxAgeMs honors REFRESH_TOKEN_TTL_DAYS from config', () => {
      expect(service.getRefreshCookieMaxAgeMs()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
