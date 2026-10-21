import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Headers,
  Res,
  Header,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthResponse, UserSummary } from '@kitchentodoor/shared';
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  LanguagePreferenceSchema,
  type Language,
} from '@kitchentodoor/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { LoginDto, RegisterDto } from '@kitchentodoor/shared';
import { Throttle } from '@nestjs/throttler';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { isAllowedOrigin } from '../common/cors.js';

type CookieResponse = { header(name: string, value: string): unknown };
const refreshCookie = (cookies = '') =>
  cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('ktd_refresh='))
    ?.slice('ktd_refresh='.length) || '';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  private setRefresh(response: CookieResponse, token: string) {
    const settings = getRuntimeSettings();
    response.header('Cache-Control', 'no-store');
    response.header(
      'Set-Cookie',
      `ktd_refresh=${token}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${token ? Math.floor(settings.AUTH_SESSION_TTL_MS / 1000) : 0}${settings.AUTH_COOKIE_SECURE ? '; Secure' : ''}`,
    );
  }

  @Post('login')
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().LOGIN_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().LOGIN_RATE_LIMIT_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponse> {
    const { refreshToken, ...auth } = await this.authService.login(body);
    this.setRefresh(response, refreshToken);
    return auth;
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
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponse> {
    const { refreshToken, ...auth } = await this.authService.register(body);
    this.setRefresh(response, refreshToken);
    return auth;
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserSummary): Promise<UserSummary> {
    const fresh = await this.authService.findById(user.id);
    if (!fresh)
      throw new UnauthorizedException('Your account is no longer available. Please sign in again.');
    return fresh;
  }

  @Patch('preferences')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async preferences(
    @CurrentUser() user: UserSummary,
    @Body(new ZodValidationPipe(LanguagePreferenceSchema)) body: { language: Language },
  ): Promise<{ language: Language; languageVersion: number }> {
    return this.authService.updateLanguage(user.id, body.language);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') authorization: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    if (!isAllowedOrigin(origin)) throw new ForbiddenException();
    await this.authService.logout(authorization, refreshCookie(cookie));
    this.setRefresh(response, '');
    return { success: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().REFRESH_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().RATE_LIMIT_TTL_MS,
    },
  })
  async refresh(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponse> {
    if (!isAllowedOrigin(origin)) throw new ForbiddenException();
    try {
      const { refreshToken, ...auth } = await this.authService.refresh(refreshCookie(cookie));
      this.setRefresh(response, refreshToken);
      return auth;
    } catch (error) {
      // An unavailable database does not invalidate a still-valid refresh credential.
      if (error instanceof UnauthorizedException) this.setRefresh(response, '');
      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().RESET_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().RATE_LIMIT_TTL_MS,
    },
  })
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body: { email: string }) {
    await this.authService.forgotPassword(body.email);
    return {
      success: true,
      message: 'If an account matches that email, a password reset link will be sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().RESET_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().RATE_LIMIT_TTL_MS,
    },
  })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: {
      token: string;
      password: string;
      confirmPassword: string;
    },
  ) {
    await this.authService.resetPassword(body.token, body.password);
    return { success: true };
  }
}
