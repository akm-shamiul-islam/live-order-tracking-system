import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    if (ctx.getType() === 'http') {
      const request = ctx.switchToHttp().getRequest();
      return data ? request.user?.[data] : request.user;
    }
    if (ctx.getType() === 'ws') {
      const client = ctx.switchToWs().getClient();
      return data ? client.user?.[data] : client.user;
    }
    return null;
  },
);
