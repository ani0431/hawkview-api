import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(ms|s|m|h|d)$/, {
    message: 'JWT_ACCESS_TTL must be a duration like 15m, 1h, 30s',
  })
  JWT_ACCESS_TTL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_TTL_DAYS?: number;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors.flatMap((e) =>
      e.constraints ? Object.values(e.constraints) : [],
    );
    throw new Error(`Environment validation failed:\n${messages.join('\n')}`);
  }
  return config;
}
