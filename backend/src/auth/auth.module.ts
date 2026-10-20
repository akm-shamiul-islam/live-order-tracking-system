import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RolesGuard } from './guards/roles.guard.js';
import { WsJwtGuard } from './guards/ws-jwt.guard.js';
import { getJwtSecret } from './jwt.config.js';
import type { JwtSignOptions } from '@nestjs/jwt';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RolesGuard, WsJwtGuard],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, WsJwtGuard, JwtModule],
})
export class AuthModule {}
