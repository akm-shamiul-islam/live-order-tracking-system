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
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { RecoveryMailer } from './recovery-mailer.js';
import { AuthOtpService } from './auth-otp.service.js';
import { ProfilesModule } from '../profiles/profiles.module.js';

@Module({
  imports: [
    DatabaseModule,
    ProfilesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: getRuntimeSettings().JWT_EXPIRES_IN,
        },
      }),
    }),
  ],
  providers: [AuthService, AuthOtpService, JwtStrategy, RolesGuard, WsJwtGuard, RecoveryMailer],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, WsJwtGuard, JwtModule],
})
export class AuthModule {}
