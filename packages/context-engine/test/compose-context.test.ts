// @ts-ignore
import { describe, it, expect } from 'vitest';
import { composeContext, Scene, CanonFact } from '../src';

describe('composeContext', () => {
  it('redacts unrevealed facts', () => {
    const scene: Scene = { id: 20, text: '' };
    const facts: CanonFact[] = [
      { entityId: 'A', fact: 'is_villain', revealAtScene: 45 },
      { entityId: 'A', fact: 'is_tall', revealed: true }
    ];
    const ctx = composeContext(scene, facts);
    expect(ctx).toContain('is_tall');
    expect(ctx).not.toContain('is_villain');
  });
});
