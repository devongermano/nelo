import { Module } from '@nestjs/common';
import { ContextModule } from './context/context.module';
import { ProjectsModule } from './projects/projects.module';
import { ScenesModule } from './scenes/scenes.module';

@Module({
  imports: [ProjectsModule, ScenesModule, ContextModule],
})
export class AppModule {}
