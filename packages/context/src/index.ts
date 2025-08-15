import { ComposeContextOptionsSchema, type ComposeContextOptions } from './types';

export function composeContext(options: ComposeContextOptions) {
  ComposeContextOptionsSchema.parse(options);
  return { segments: [], redactions: [] };
}

export { ComposeContextOptionsSchema } from './types';
export type { ComposeContextOptions } from './types';
