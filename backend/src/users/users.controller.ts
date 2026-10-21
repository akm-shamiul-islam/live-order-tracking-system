import { Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  PageNumberSchema,
  UpdateUserSchema,
  UserIdSchema,
  UserRole,
  UserRoleSchema,
  type UpdateUserDto,
  type UserSummary,
} from '@kitchentodoor/shared';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import { UsersService } from './users.service.js';

const querySchema = () =>
  z.object({
    page: PageNumberSchema.default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(getRuntimeSettings().USER_LIST_MAX_LIMIT)
      .default(getRuntimeSettings().USER_LIST_DEFAULT_LIMIT),
    q: z.string().trim().max(100).default(''),
    role: UserRoleSchema.optional(),
  });

@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(querySchema)) query: z.infer<ReturnType<typeof querySchema>>) {
    return this.users.list(query.page, query.limit, query.q, query.role);
  }

  @Patch(':id')
  async update(
    @Param('id', new ZodValidationPipe(UserIdSchema)) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserDto,
    @CurrentUser() actor: UserSummary,
  ) {
    return { user: await this.users.update(id, body, actor) };
  }
}
