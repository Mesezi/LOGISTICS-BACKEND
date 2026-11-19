import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveJob(jobId: number, accountId: number) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, account_id: accountId },
      include: { payments: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private calcReceived(payments: { type: string; amount: number }[]) {
    return payments.reduce(
      (sum, p) => sum + (p.type === 'payment' ? p.amount : -p.amount),
      0,
    );
  }

  async listForJob(jobId: number, user: AuthenticatedUser) {
    await this.resolveJob(jobId, user.accountId);

    const payments = await this.prisma.payment.findMany({
      where: { job_id: jobId },
      orderBy: { paid_at: 'asc' },
    });

    return { data: payments };
  }

  async addPayment(jobId: number, user: AuthenticatedUser, dto: CreatePaymentDto) {
    const job = await this.resolveJob(jobId, user.accountId);

    if (job.status === 'cancelled') {
      throw new BadRequestException('Cannot add payment to a cancelled job');
    }

    if (dto.mode === 'transfer' && !dto.bank_name?.trim()) {
      throw new BadRequestException('bank_name is required for transfer payments');
    }

    const received = this.calcReceived(job.payments);
    const remaining = job.total - received;

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds remaining balance (${remaining})`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        job_id: jobId,
        type: 'payment',
        amount: dto.amount,
        mode: dto.mode,
        bank_name: dto.bank_name?.trim() ?? null,
        note: dto.note ?? null,
        reference: dto.reference ?? null,
        ...(dto.paid_at && { paid_at: new Date(dto.paid_at) }),
      },
    });

    return { message: 'Payment recorded successfully', data: payment };
  }

  async addRefund(jobId: number, user: AuthenticatedUser, dto: CreatePaymentDto) {
    const job = await this.resolveJob(jobId, user.accountId);

    if (dto.mode === 'transfer' && !dto.bank_name?.trim()) {
      throw new BadRequestException('bank_name is required for transfer refunds');
    }

    const received = this.calcReceived(job.payments);

    if (dto.amount > received) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds total received (${received})`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        job_id: jobId,
        type: 'refund',
        amount: dto.amount,
        mode: dto.mode,
        bank_name: dto.bank_name?.trim() ?? null,
        note: dto.note ?? null,
        reference: dto.reference ?? null,
        ...(dto.paid_at && { paid_at: new Date(dto.paid_at) }),
      },
    });

    return { message: 'Refund recorded successfully', data: payment };
  }

  async update(id: number, user: AuthenticatedUser, dto: Partial<CreatePaymentDto>) {
    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: { job: { include: { payments: true } } },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.job.account_id !== user.accountId) throw new NotFoundException('Payment not found');

    const mode = dto.mode ?? payment.mode;
    const bankName = 'bank_name' in dto ? dto.bank_name : payment.bank_name;
    if (mode === 'transfer' && !bankName?.trim()) {
      throw new BadRequestException('bank_name is required for transfer payments');
    }

    // Re-verify totals if amount is changing
    if (dto.amount !== undefined) {
      const otherPayments = payment.job.payments.filter((p) => p.id !== id);
      const received = this.calcReceived([
        ...otherPayments,
        { type: payment.type, amount: dto.amount },
      ]);

      if (payment.type === 'payment' && received > payment.job.total) {
        throw new BadRequestException(
          `Updated amount would exceed job total (${payment.job.total})`,
        );
      }
      if (payment.type === 'refund') {
        const totalPaid = this.calcReceived(otherPayments.filter((p) => p.type === 'payment'));
        if (dto.amount > totalPaid) {
          throw new BadRequestException(
            `Refund amount (${dto.amount}) would exceed total paid (${totalPaid})`,
          );
        }
      }
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.mode && { mode: dto.mode }),
        ...('bank_name' in dto && { bank_name: dto.bank_name?.trim() ?? null }),
        ...('note' in dto && { note: dto.note ?? null }),
        ...('reference' in dto && { reference: dto.reference ?? null }),
        ...(dto.paid_at && { paid_at: new Date(dto.paid_at) }),
      },
    });

    return { message: 'Payment updated successfully', data: updated };
  }

  async delete(id: number, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findFirst({
      where: { id },
      include: { job: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.job.account_id !== user.accountId) throw new NotFoundException('Payment not found');

    try {
      await this.prisma.payment.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Payment not found');
      }
      throw error;
    }

    return { message: 'Payment deleted successfully' };
  }
}
