import { validateComposeContextOptions, type ComposeContextOptions } from './types';

export interface ComposeContextResult {
  segments: any[];
  redactions: any[];
}

export function composeContext(options: ComposeContextOptions): ComposeContextResult {
  const validation = validateComposeContextOptions(options);
  if (!validation.success) {
    throw new Error('Invalid options: ' + JSON.stringify(validation.errors));
  }
  return { segments: [], redactions: [] };
}

export { validateComposeContextOptions } from './types';
export type { ComposeContextOptions } from './types';
