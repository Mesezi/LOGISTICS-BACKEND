import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { ClientStatementDto } from './dto/client-statement.dto.js';
import { DailyReportDto } from './dto/daily-report.dto.js';
import { ListReportItemsDto } from './dto/list-report-items.dto.js';
import { ReportDateRangeDto } from './dto/report-date-range.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily')
  daily(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyReportDto,
  ) {
    return this.reports.daily(user, query);
  }

  @Get('income')
  income(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeDto,
  ) {
    return this.reports.income(user, query);
  }

  @Get('riders')
  riders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeDto,
  ) {
    return this.reports.riders(user, query);
  }

  @Get('sublets')
  sublets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeDto,
  ) {
    return this.reports.sublets(user, query);
  }

  @Get('partners')
  partners(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportDateRangeDto,
  ) {
    return this.reports.partners(user, query);
  }

  @Get('failed-jobs')
  failedJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportItemsDto,
  ) {
    return this.reports.failedJobs(user, query);
  }

  @Get('debts')
  debts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportItemsDto,
  ) {
    return this.reports.debts(user, query);
  }

  @Get('client-statement')
  clientStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClientStatementDto,
  ) {
    return this.reports.clientStatement(user, query);
  }
}
