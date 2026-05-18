import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantResponseDto } from './dto/tenant-response.dto';

export type ConnectTenantInput = {
  userId: string;
  microsoftTenantId: string;
  displayName: string;
};

const TENANT_PUBLIC_SELECT = {
  id: true,
  displayName: true,
  microsoftTenantId: true,
  connectedAt: true,
  isActive: true,
} as const;

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async connectTenant(input: ConnectTenantInput): Promise<{ id: string }> {
    try {
      const tenant = await this.prisma.tenant.create({
        data: {
          userId: input.userId,
          microsoftTenantId: input.microsoftTenantId,
          displayName: input.displayName,
        },
        select: { id: true },
      });
      return { id: tenant.id };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new HttpException(
          {
            code: 'TENANT_ALREADY_CONNECTED',
            message:
              'This Microsoft tenant is already connected for your account.',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  async listTenants(userId: string): Promise<TenantResponseDto[]> {
    return this.prisma.tenant.findMany({
      where: { userId, isActive: true },
      orderBy: { connectedAt: 'desc' },
      select: TENANT_PUBLIC_SELECT,
    });
  }

  async getTenant(userId: string, id: string): Promise<TenantResponseDto> {
    try {
      return await this.prisma.tenant.findFirstOrThrow({
        where: { id, userId },
        select: TENANT_PUBLIC_SELECT,
      });
    } catch (e) {
      throw this.mapNotFound(e);
    }
  }

  async disconnectTenant(
    userId: string,
    id: string,
  ): Promise<{ disconnected: true }> {
    try {
      await this.prisma.tenant.findFirstOrThrow({
        where: { id, userId },
        select: { id: true },
      });
    } catch (e) {
      throw this.mapNotFound(e);
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });
    return { disconnected: true };
  }

  private mapNotFound(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      return new HttpException(
        {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found or does not belong to the current user.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return e;
  }
}
