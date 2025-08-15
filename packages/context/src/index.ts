import { ComposeContextOptionsSchema, type ComposeContextOptions } from './types';

export interface ComposeContextResult {
  segments: any[];
  redactions: any[];
}

export function composeContext(options: ComposeContextOptions): ComposeContextResult {
  ComposeContextOptionsSchema.parse(options);
  return { segments: [], redactions: [] };
}

export { ComposeContextOptionsSchema } from './types';
export type { ComposeContextOptions } from './types';
