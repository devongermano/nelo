import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';

@Module({
  controllers: [ScenesController],
})
export class AppModule {}
