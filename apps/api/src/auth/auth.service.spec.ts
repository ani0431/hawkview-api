import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
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
  };
  const jwt = { sign: jest.fn() };

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
});
