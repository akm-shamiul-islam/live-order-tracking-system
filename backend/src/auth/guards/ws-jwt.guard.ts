import { CanActivate, ExecutionContext, Injectable, Logger, Inject } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthService } from '../auth.service.js';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization;

    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
      throw new WsException('Unauthorized: Missing authentication token');
    }

    try {
      if (typeof token !== 'string') throw new Error('Invalid authentication token');
      const user = await this.authService.verifyToken(token.replace(/^Bearer\s+/i, ''));
      client.user = user;
      return true;
    } catch {
      this.logger.warn(`Rejected invalid token socket connection: ${client.id}`);
      throw new WsException('Unauthorized: Invalid or expired authentication token');
    }
  }
}
