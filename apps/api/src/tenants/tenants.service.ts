import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

export type ConnectTenantInput = {
  userId: string;
  microsoftTenantId: string;
  displayName: string;
};

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
}
