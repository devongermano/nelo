export const GATEWAY_EVENTS = {
  HELLO: 'HELLO',
  PING: 'PING',
  PONG: 'PONG',
} as const;

export type GatewayEvent = typeof GATEWAY_EVENTS[keyof typeof GATEWAY_EVENTS];

export interface HelloPayload {
  sessionId: string;
}

export type GatewayMessage =
  | { event: typeof GATEWAY_EVENTS.HELLO; data: HelloPayload }
  | { event: typeof GATEWAY_EVENTS.PING }
  | { event: typeof GATEWAY_EVENTS.PONG };

