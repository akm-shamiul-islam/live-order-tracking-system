import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserSummary } from '@kitchentodoor/shared';
import type { AuthenticatedRequest, OrderSocket } from '../authenticated-context.js';

export const CurrentUser = createParamDecorator(
  (data: keyof UserSummary | undefined, ctx: ExecutionContext) => {
    if (ctx.getType() === 'http') {
      const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
      return data ? request.user?.[data] : request.user;
    }
    if (ctx.getType() === 'ws') {
      const client = ctx.switchToWs().getClient<OrderSocket>();
      return data ? client.data.user?.[data] : client.data.user;
    }
    return null;
  },
);
