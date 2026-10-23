import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthService } from '../auth.service.js';
import { socketCredential, type OrderSocket } from '../authenticated-context.js';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<OrderSocket>();
    const token = socketCredential(client);

    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
      throw new WsException('Unauthorized: Missing authentication token');
    }

    try {
      if (typeof token !== 'string')
        throw new UnauthorizedException('Invalid authentication token');
      const user = await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''));
      client.data.user = user;
      return true;
    } catch (error) {
      if (!(error instanceof UnauthorizedException))
        throw new WsException('The order service is temporarily unavailable. Please try again.');
      this.logger.warn(`Rejected invalid token socket connection: ${client.id}`);
      throw new WsException('Unauthorized: Invalid or expired authentication token');
    }
  }
}
