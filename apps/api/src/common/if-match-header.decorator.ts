import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IfMatchHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers['if-match'];
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException('If-Match header required');
    }
    return value;
  },
);
