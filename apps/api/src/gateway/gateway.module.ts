import { Module } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway.nestjs';

@Module({
  providers: [PresenceGateway],
})
export class GatewayModule {}