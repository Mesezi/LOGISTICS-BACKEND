import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { AccountsService } from './accounts.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Controller('accounts')
@UseGuards(RolesGuard)
@Roles('admin')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateAccountDto,
  ) {
    return this.accounts.update(user, body);
  }
}
