import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsService } from './audit-logs.service.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, RolesGuard],
})
export class AuditLogsModule {}
