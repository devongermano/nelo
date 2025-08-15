import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { GATEWAY_EVENTS, GatewayMessage } from './events';

export function createPresenceGateway(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    const sessionId = randomUUID();
    const hello: GatewayMessage = {
      event: GATEWAY_EVENTS.HELLO,
      data: { sessionId },
    };
    ws.send(JSON.stringify(hello));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as GatewayMessage;
        if (msg.event === GATEWAY_EVENTS.PING) {
          const pong: GatewayMessage = { event: GATEWAY_EVENTS.PONG };
          ws.send(JSON.stringify(pong));
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  return wss;
}

