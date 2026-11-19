import { Body, Controller, Delete, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Partial<CreatePaymentDto>,
  ) {
    return this.payments.update(id, user, body);
  }

  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.delete(id, user);
  }
}
