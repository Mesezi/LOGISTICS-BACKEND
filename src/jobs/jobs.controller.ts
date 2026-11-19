import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { ListJobsDto } from './dto/list-jobs.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto.js';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListJobsDto,
  ) {
    return this.jobs.list(user, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.findOne(id, user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateJobDto,
  ) {
    return this.jobs.create(user, body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateJobDto,
  ) {
    return this.jobs.update(id, user, body);
  }

  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.delete(id, user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.jobs.cancel(id, user);
  }

  // Payments
  @Get(':id/payments')
  listPayments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.listForJob(id, user);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentDto,
  ) {
    return this.payments.addPayment(id, user, body);
  }

  @Post(':id/refunds')
  addRefund(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentDto,
  ) {
    return this.payments.addRefund(id, user, body);
  }
}
