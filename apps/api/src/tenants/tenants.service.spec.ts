import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;

  const prisma = {
    tenant: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('connectTenant', () => {
    const input = {
      userId: 'user-1',
      microsoftTenantId: 'ms-tenant-guid',
      displayName: 'ms-tenant-guid',
    };

    it('creates a tenant scoped to userId and returns its id', async () => {
      prisma.tenant.create.mockResolvedValue({ id: 'tenant-1' });

      const result = await service.connectTenant(input);

      expect(result).toEqual({ id: 'tenant-1' });
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          microsoftTenantId: 'ms-tenant-guid',
          displayName: 'ms-tenant-guid',
        },
        select: { id: true },
      });
    });

    it('maps P2002 unique constraint to TENANT_ALREADY_CONNECTED 409', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
      prisma.tenant.create.mockRejectedValue(err);

      try {
        await service.connectTenant(input);
        fail('expected TENANT_ALREADY_CONNECTED to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(409);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'TENANT_ALREADY_CONNECTED',
        });
      }
    });

    it('rethrows non-P2002 errors unchanged', async () => {
      const err = new Error('db down');
      prisma.tenant.create.mockRejectedValue(err);

      await expect(service.connectTenant(input)).rejects.toBe(err);
    });
  });
});
