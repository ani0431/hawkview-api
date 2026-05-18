import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@ApiTags('tenants')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({
    summary: 'List active Microsoft tenants connected by the current user',
  })
  @ApiOkResponse({
    description:
      'Returns the active tenants belonging to the authenticated user. Inactive (disconnected) tenants are excluded.',
  })
  @ApiUnauthorizedResponse({
    description: 'UNAUTHORIZED — access token missing, invalid, or expired.',
  })
  async list(@Req() req: AuthedRequest) {
    const tenants = await this.tenantsService.listTenants(req.user.id);
    return { success: true, data: { tenants } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single tenant owned by the current user' })
  @ApiOkResponse({ description: 'Returns the tenant.' })
  @ApiUnauthorizedResponse({
    description: 'UNAUTHORIZED — access token missing, invalid, or expired.',
  })
  @ApiNotFoundResponse({
    description: 'TENANT_NOT_FOUND — id does not exist or belongs to another user.',
  })
  async getOne(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const tenant = await this.tenantsService.getTenant(req.user.id, id);
    return { success: true, data: { tenant } };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disconnect a tenant (soft delete — sets isActive=false)',
  })
  @ApiOkResponse({ description: 'Tenant disconnected.' })
  @ApiUnauthorizedResponse({
    description: 'UNAUTHORIZED — access token missing, invalid, or expired.',
  })
  @ApiNotFoundResponse({
    description: 'TENANT_NOT_FOUND — id does not exist or belongs to another user.',
  })
  async disconnect(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.tenantsService.disconnectTenant(req.user.id, id);
    return { success: true, data: result };
  }
}
