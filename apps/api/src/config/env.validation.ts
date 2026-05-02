import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  JWT_SECRET!: string;
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
