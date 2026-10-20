import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@kitchentodoor/shared';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    let user: any;
    if (context.getType() === 'http') {
      user = context.switchToHttp().getRequest().user;
    } else if (context.getType() === 'ws') {
      user = context.switchToWs().getClient().user;
    }

    if (!user || !requiredRoles.includes(user.role)) {
      if (context.getType() === 'ws') {
        throw new WsException('Insufficient permissions to perform this operation');
      }
      throw new ForbiddenException('Insufficient permissions to perform this operation');
    }

    return true;
  }
}
