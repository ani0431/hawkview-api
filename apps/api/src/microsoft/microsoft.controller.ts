import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from '../tenants/tenants.service';
import { CallbackQueryDto } from './dto/callback-query.dto';
import { MicrosoftService } from './microsoft.service';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_COOKIE_PATH = '/microsoft';
const OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

type AuthedRequest = Request & {
  user: { id: string; email: string; role: string };
};

@ApiTags('microsoft')
@Controller('microsoft')
export class MicrosoftController {
  constructor(
    private readonly microsoftService: MicrosoftService,
    private readonly tenantsService: TenantsService,
    private readonly config: ConfigService,
  ) {}

  @Get('auth/url')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Build the Microsoft admin-consent URL for tenant connection',
    description:
      'Generates a random `state` bound to the current user, stores `{state,userId}` in a signed httpOnly `oauth_state` cookie (10 min, path `/microsoft`), and returns the Azure admin-consent URL. The callback verifies the state to prevent CSRF.',
  })
  @ApiOkResponse({ description: 'Returns the Azure admin-consent URL.' })
  @ApiUnauthorizedResponse({
    description: 'UNAUTHORIZED — access token missing, invalid, or expired.',
  })
  getAuthUrl(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { url, cookieValue } = this.microsoftService.buildConsentUrl(
      req.user.id,
    );
    res.cookie(OAUTH_STATE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      signed: true,
      path: OAUTH_STATE_COOKIE_PATH,
      maxAge: OAUTH_STATE_COOKIE_MAX_AGE_MS,
    });
    return { success: true, data: { url } };
  }

  @Get('auth/callback')
  @ApiOperation({
    summary: 'Handle the Microsoft admin-consent redirect',
    description:
      'Microsoft redirects the admin here after granting consent. Verifies the signed `oauth_state` cookie against the `state` query param, confirms `admin_consent=True`, and persists a Tenant row scoped to the HawkView user that started the flow.',
  })
  @ApiOkResponse({ description: 'Tenant connected.' })
  @ApiBadRequestResponse({
    description: 'OAUTH_STATE_MISMATCH or OAUTH_CONSENT_DENIED.',
  })
  @ApiConflictResponse({ description: 'TENANT_ALREADY_CONNECTED.' })
  async handleCallback(
    @Query() query: CallbackQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.admin_consent !== 'True') {
      throw new HttpException(
        {
          code: 'OAUTH_CONSENT_DENIED',
          message: 'Admin consent was not granted.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rawCookie = req.signedCookies?.[OAUTH_STATE_COOKIE];
    const { userId } = this.microsoftService.verifyStateCookie(
      rawCookie,
      query.state,
    );

    const { id } = await this.tenantsService.connectTenant({
      userId,
      microsoftTenantId: query.tenant,
      displayName: query.tenant,
    });

    res.clearCookie(OAUTH_STATE_COOKIE, {
      path: OAUTH_STATE_COOKIE_PATH,
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction(),
    });

    return { success: true, data: { tenantId: id } };
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
