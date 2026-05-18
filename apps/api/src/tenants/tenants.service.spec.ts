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
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  const PUBLIC_SELECT = {
    id: true,
    displayName: true,
    microsoftTenantId: true,
    connectedAt: true,
    isActive: true,
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

  describe('listTenants', () => {
    it('filters by userId + isActive:true and selects only public fields', async () => {
      const rows = [
        {
          id: 't1',
          displayName: 'Acme',
          microsoftTenantId: 'ms-1',
          connectedAt: new Date('2026-05-01T00:00:00Z'),
          isActive: true,
        },
        {
          id: 't2',
          displayName: 'Beta',
          microsoftTenantId: 'ms-2',
          connectedAt: new Date('2026-05-02T00:00:00Z'),
          isActive: true,
        },
      ];
      prisma.tenant.findMany.mockResolvedValue(rows);

      const result = await service.listTenants('user-1');

      expect(result).toEqual(rows);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        orderBy: { connectedAt: 'desc' },
        select: PUBLIC_SELECT,
      });
    });

    it('returns an empty array when the user has no active tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);
      await expect(service.listTenants('user-1')).resolves.toEqual([]);
    });
  });

  describe('getTenant', () => {
    it('returns the tenant when it belongs to the user', async () => {
      const row = {
        id: 't1',
        displayName: 'Acme',
        microsoftTenantId: 'ms-1',
        connectedAt: new Date(),
        isActive: true,
      };
      prisma.tenant.findFirstOrThrow.mockResolvedValue(row);

      const result = await service.getTenant('user-1', 't1');

      expect(result).toBe(row);
      expect(prisma.tenant.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user-1' },
        select: PUBLIC_SELECT,
      });
    });

    it('throws TENANT_NOT_FOUND 404 when the row belongs to another user (P2025)', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      prisma.tenant.findFirstOrThrow.mockRejectedValue(err);

      try {
        await service.getTenant('user-1', 't-other');
        fail('expected TENANT_NOT_FOUND to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(404);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'TENANT_NOT_FOUND',
        });
      }
    });

    it('rethrows non-P2025 errors unchanged', async () => {
      const err = new Error('db down');
      prisma.tenant.findFirstOrThrow.mockRejectedValue(err);
      await expect(service.getTenant('user-1', 't1')).rejects.toBe(err);
    });
  });

  describe('disconnectTenant', () => {
    it('soft-deletes by setting isActive=false (not row delete) and returns disconnected:true', async () => {
      prisma.tenant.findFirstOrThrow.mockResolvedValue({ id: 't1' });
      prisma.tenant.update.mockResolvedValue({ id: 't1', isActive: false });

      const result = await service.disconnectTenant('user-1', 't1');

      expect(result).toEqual({ disconnected: true });
      expect(prisma.tenant.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'user-1' },
        select: { id: true },
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { isActive: false },
      });
    });

    it('throws TENANT_NOT_FOUND 404 when row belongs to another user, and never issues an update', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      prisma.tenant.findFirstOrThrow.mockRejectedValue(err);

      try {
        await service.disconnectTenant('user-1', 't-other');
        fail('expected TENANT_NOT_FOUND to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(404);
        expect((e as HttpException).getResponse()).toMatchObject({
          code: 'TENANT_NOT_FOUND',
        });
      }
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});
