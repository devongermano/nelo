import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { randomUUID } from 'crypto';
import { GATEWAY_EVENTS, GatewayMessage, HelloPayload } from './events';

@WebSocketGateway({ adapter: 'ws' })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private sessions = new Map<any, string>();

  handleConnection(client: any) {
    const sessionId = randomUUID();
    this.sessions.set(client, sessionId);
    
    const hello: GatewayMessage = {
      event: GATEWAY_EVENTS.HELLO,
      data: { sessionId },
    };
    
    client.send(JSON.stringify(hello));
  }

  handleDisconnect(client: any) {
    this.sessions.delete(client);
  }

  @SubscribeMessage(GATEWAY_EVENTS.PING)
  handlePing(@ConnectedSocket() client: any): void {
    const pong: GatewayMessage = { event: GATEWAY_EVENTS.PONG };
    client.send(JSON.stringify(pong));
  }
}