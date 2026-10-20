import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthResponse, UserSummary } from '@kitchentodoor/shared';
import { LoginSchema, RegisterSchema } from '@kitchentodoor/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { LoginDto, RegisterDto } from '@kitchentodoor/shared';
import { Throttle } from '@nestjs/throttler';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().LOGIN_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().LOGIN_RATE_LIMIT_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto): Promise<AuthResponse> {
    return this.authService.login(body);
  }

  @Post('register')
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().REGISTER_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().REGISTER_RATE_LIMIT_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto,
  ): Promise<AuthResponse> {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserSummary): Promise<UserSummary> {
    const fresh = await this.authService.findById(user.id);
    if (!fresh)
      throw new UnauthorizedException('Your account is no longer available. Please sign in again.');
    return fresh;
  }
}
