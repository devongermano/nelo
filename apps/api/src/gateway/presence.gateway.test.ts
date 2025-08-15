import { describe, it, expect } from 'vitest';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { createPresenceGateway } from './presence.gateway';
import { GATEWAY_EVENTS } from './events';

describe('presence gateway', () => {
  it('sends HELLO on connect and PONG for PING', async () => {
    const wss = createPresenceGateway(0);
    const port = (wss.address() as AddressInfo).port;
    const ws = new WebSocket(`ws://localhost:${port}`);

    const helloPromise = new Promise<any>((resolve) =>
      ws.once('message', (data) => resolve(JSON.parse(data.toString())))
    );
    await new Promise((resolve) => ws.once('open', resolve));
    const hello = await helloPromise;

    expect(hello.event).toBe(GATEWAY_EVENTS.HELLO);
    expect(hello.data.sessionId).toBeTypeOf('string');

    const pongPromise = new Promise<any>((resolve) =>
      ws.once('message', (data) => resolve(JSON.parse(data.toString())))
    );
    ws.send(JSON.stringify({ event: GATEWAY_EVENTS.PING }));
    const pong = await pongPromise;

    expect(pong.event).toBe(GATEWAY_EVENTS.PONG);

    ws.close();
    wss.close();
  });
});

