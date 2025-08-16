import typia, { tags } from 'typia';

export interface EnvironmentVariables {
  NODE_ENV?: ('development' | 'production' | 'test') & tags.Default<'development'>;
  PORT?: number & tags.Type<"uint32"> & tags.Minimum<1> & tags.Maximum<65535> & tags.Default<3001>;
  DATABASE_URL?: string & tags.Default<'postgresql://localhost:5432/nelo'>;
  REDIS_URL?: string & tags.Default<'redis://localhost:6379'>;
  CORS_ORIGINS?: string & tags.Default<'http://localhost:3000'>;
}

export const validateEnvironment = typia.createAssert<EnvironmentVariables>();

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  // Apply defaults and validate
  const validated = validateEnvironment(config);
  return validated;
}