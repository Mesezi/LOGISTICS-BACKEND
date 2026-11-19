import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.syncUser(user.clerkId);
  }

  @Post('invite')
  @Roles('admin')
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: InviteUserDto,
  ) {
    return this.usersService.invite(user, body);
  }
}
