import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  NotificationQuerySchema,
  NotificationReadSchema,
  NotificationDismissSchema,
  ProfileDecisionSchema,
  UpdateProfileSchema,
  UserIdSchema,
  UserRole,
  type ProfileDecisionDto,
  type NotificationQuery,
  type NotificationReadDto,
  type NotificationDismissDto,
  type UpdateProfileDto,
  type UserSummary,
} from '@kitchentodoor/shared';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { ProfilesService } from './profiles.service.js';

@Controller('api/profile')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentUser() actor: UserSummary) {
    return this.profiles.get(actor);
  }
  @Patch()
  @Throttle({
    default: {
      limit: () => getRuntimeSettings().PROFILE_CHANGE_RATE_LIMIT_MAX,
      ttl: () => getRuntimeSettings().RATE_LIMIT_TTL_MS,
    },
  })
  @Header('Cache-Control', 'no-store')
  request(
    @CurrentUser() actor: UserSummary,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileDto,
  ) {
    return this.profiles.request(actor, body);
  }
  @Get('photos/:id')
  async photo(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @CurrentUser() actor: UserSummary,
    @Res() response: FastifyReply,
  ) {
    const photo = await this.profiles.photo(id, actor);
    return response
      .header('Cache-Control', 'private, no-store')
      .header('Content-Type', 'image/webp')
      .header('X-Content-Type-Options', 'nosniff')
      .send(photo);
  }
}
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() actor: UserSummary,
    @Query(new ZodValidationPipe(NotificationQuerySchema)) query: NotificationQuery,
  ) {
    return this.profiles.notifications(actor, query);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @CurrentUser() actor: UserSummary,
  ) {
    return { notification: await this.profiles.notification(id, actor) };
  }
  @Patch(':id/read')
  async read(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @CurrentUser() actor: UserSummary,
    @Body(new ZodValidationPipe(NotificationReadSchema)) body: NotificationReadDto,
  ) {
    await this.profiles.read(id, actor, body.unread, body.expectedUpdatedAt);
    return { success: true };
  }
  @Patch(':id/dismiss')
  async dismiss(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @CurrentUser() actor: UserSummary,
    @Body(new ZodValidationPipe(NotificationDismissSchema)) body: NotificationDismissDto,
  ) {
    await this.profiles.dismiss(id, actor, body.expectedUpdatedAt);
    return { success: true };
  }
  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Header('Cache-Control', 'no-store')
  async review(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @CurrentUser() actor: UserSummary,
    @Body(new ZodValidationPipe(ProfileDecisionSchema)) body: ProfileDecisionDto,
  ) {
    return { notification: await this.profiles.review(id, body, actor) };
  }
}
