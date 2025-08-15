// @ts-ignore
import { describe, it, expect } from 'vitest';
import { composeContext } from '../src';

describe('composeContext', () => {
  it('validates options', () => {
    // missing required template should throw
    expect(() => composeContext({} as any)).toThrow();
  });

  it('returns empty arrays for segments and redactions', () => {
    const result = composeContext({ template: 'hello' });
    expect(result).toEqual({ segments: [], redactions: [] });
  });
});
