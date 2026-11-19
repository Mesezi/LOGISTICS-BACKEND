import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { AuditLogsService } from './audit-logs.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('admin')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAuditLogsDto,
  ) {
    return this.auditLogs.list(user, query);
  }
}
