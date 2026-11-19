import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { ListExpensesDto } from './dto/list-expenses.dto.js';
import { Prisma } from '../generated/prisma/client.js';

function validateOwnerRules(dto: Partial<CreateExpenseDto>) {
  if (dto.owner === 'rider' && !dto.rider_id) {
    throw new BadRequestException('rider_id is required when owner is rider');
  }
  if (dto.owner === 'client' && !dto.client_id) {
    throw new BadRequestException('client_id is required when owner is client');
  }
  if (dto.owner === 'office' && (dto.rider_id || dto.client_id)) {
    throw new BadRequestException('rider_id and client_id must be empty when owner is office');
  }
  if (dto.owner === 'rider' && dto.client_id) {
    throw new BadRequestException('client_id must be empty when owner is rider');
  }
  if (dto.owner === 'client' && dto.rider_id) {
    throw new BadRequestException('rider_id must be empty when owner is client');
  }
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListExpensesDto) {
    const { page, limit, owner, rider_id, client_id, job_id, date_from, date_to } = query;

    const where: Prisma.ExpenseWhereInput = {
      account_id: user.accountId,
      ...(owner && { owner }),
      ...(rider_id && { rider_id }),
      ...(client_id && { client_id }),
      ...(job_id && { job_id }),
      ...(date_from || date_to
        ? {
            expense_date: {
              ...(date_from && { gte: new Date(date_from) }),
              ...(date_to && { lte: new Date(date_to) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { expense_date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          rider: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, account_id: user.accountId },
      include: {
        rider: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        job: { select: { id: true, pickup: true, dropoff: true, job_date: true } },
      },
    });

    if (!expense) throw new NotFoundException('Expense not found');

    return { data: expense };
  }

  async create(user: AuthenticatedUser, dto: CreateExpenseDto) {
    validateOwnerRules(dto);
    if (dto.mode === 'transfer' && !dto.bank_name?.trim()) {
      throw new BadRequestException('bank_name is required for transfer expenses');
    }

    // Verify rider belongs to account
    if (dto.rider_id) {
      const rider = await this.prisma.rider.findFirst({
        where: { id: dto.rider_id, account_id: user.accountId },
      });
      if (!rider) throw new NotFoundException('Rider not found');
    }

    // Verify client belongs to account
    if (dto.client_id) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.client_id, account_id: user.accountId },
      });
      if (!client) throw new NotFoundException('Client not found');
    }

    // Verify job belongs to account
    if (dto.job_id) {
      const job = await this.prisma.job.findFirst({
        where: { id: dto.job_id, account_id: user.accountId },
      });
      if (!job) throw new NotFoundException('Job not found');
    }

    const expense = await this.prisma.expense.create({
      data: {
        account_id: user.accountId,
        user_id: user.userId,
        description: dto.description,
        amount: dto.amount,
        mode: dto.mode,
        bank_name: dto.bank_name?.trim() ?? null,
        note: dto.note ?? null,
        owner: dto.owner,
        rider_id: dto.rider_id ?? null,
        client_id: dto.client_id ?? null,
        job_id: dto.job_id ?? null,
        ...(dto.expense_date && { expense_date: new Date(dto.expense_date) }),
      },
    });

    return { message: 'Expense created successfully', data: expense };
  }

  async update(id: number, user: AuthenticatedUser, dto: Partial<CreateExpenseDto>) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, account_id: user.accountId },
    });

    if (!existing) throw new NotFoundException('Expense not found');

    // Merge owner context for validation
    const merged = {
      owner: dto.owner ?? existing.owner,
      rider_id: 'rider_id' in dto ? dto.rider_id : (existing.rider_id ?? undefined),
      client_id: 'client_id' in dto ? dto.client_id : (existing.client_id ?? undefined),
    };

    validateOwnerRules(merged);
    const mode = dto.mode ?? existing.mode;
    const bankName = 'bank_name' in dto ? dto.bank_name : existing.bank_name;
    if (mode === 'transfer' && !bankName?.trim()) {
      throw new BadRequestException('bank_name is required for transfer expenses');
    }

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.description && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.mode && { mode: dto.mode }),
        ...('bank_name' in dto && { bank_name: dto.bank_name?.trim() ?? null }),
        ...('note' in dto && { note: dto.note ?? null }),
        ...(dto.owner && { owner: dto.owner }),
        ...('rider_id' in dto && { rider_id: dto.rider_id ?? null }),
        ...('client_id' in dto && { client_id: dto.client_id ?? null }),
        ...('job_id' in dto && { job_id: dto.job_id ?? null }),
        ...(dto.expense_date && { expense_date: new Date(dto.expense_date) }),
      },
    });

    return { message: 'Expense updated successfully', data: expense };
  }

  async delete(id: number, user: AuthenticatedUser) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, account_id: user.accountId },
    });

    if (!existing) throw new NotFoundException('Expense not found');

    await this.prisma.expense.delete({ where: { id } });

    return { message: 'Expense deleted successfully' };
  }
}
