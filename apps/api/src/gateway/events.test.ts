import { describe, it, expect } from 'vitest';
import { GATEWAY_EVENTS } from './events';

describe('gateway events constants', () => {
  it('should expose expected event names', () => {
    expect(GATEWAY_EVENTS.HELLO).toBe('HELLO');
    expect(GATEWAY_EVENTS.PING).toBe('PING');
    expect(GATEWAY_EVENTS.PONG).toBe('PONG');
  });
});

