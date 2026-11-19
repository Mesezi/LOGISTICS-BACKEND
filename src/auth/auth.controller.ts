import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { RegisterDto } from './dto/register.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { AllowUnregistered } from './allow-unregistered.decorator.js';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @AllowUnregistered()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDto,
  ) {
    return this.authService.register(user.clerkId, body);
  }

  @Post('accept-invitation')
  @AllowUnregistered()
  acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AcceptInvitationDto,
  ) {
    return this.authService.acceptInvitation(user.clerkId, body);
  }
}