import { Injectable } from '@nestjs/common';
import { composeContext, ComposeContextOptions } from '@nelo/context';

@Injectable()
export class ContextService {
  compose(options: ComposeContextOptions) {
    return composeContext(options);
  }
}
