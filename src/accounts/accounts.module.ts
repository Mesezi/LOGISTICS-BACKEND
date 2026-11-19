import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, RolesGuard],
})
export class AccountsModule {}
