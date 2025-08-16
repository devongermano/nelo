import { Controller } from '@nestjs/common';
import { TypedRoute, TypedBody } from '@nestia/core';
import { ComposeContextOptions } from '@nelo/context';
import { ContextService } from './context.service';

@Controller()
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @TypedRoute.Post('compose-context')
  compose(@TypedBody() body: ComposeContextOptions) {
    return this.contextService.compose(body);
  }
}
