import { Body, Controller, Post } from '@nestjs/common';
import { ComposeContextOptions } from '@nelo/context';
import { ContextService } from './context.service';

@Controller()
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Post('compose-context')
  compose(@Body() body: ComposeContextOptions) {
    return this.contextService.compose(body);
  }
}
