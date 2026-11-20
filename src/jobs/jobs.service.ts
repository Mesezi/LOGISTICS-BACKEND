import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { ListJobsDto } from './dto/list-jobs.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { Prisma } from '../generated/prisma/client.js';

function calcTotal(dto: {
  office_fee: number;
  sublet_amount?: number;
  park_waybill?: number;
  partner_amount?: number;
}) {
  return (
    dto.office_fee +
    (dto.sublet_amount ?? 0) +
    (dto.park_waybill ?? 0) +
    (dto.partner_amount ?? 0)
  );
}

function validateJobRules(dto: Partial<CreateJobDto>) {
  const hasSublet = !!(dto.sublet_name || (dto.sublet_amount ?? 0) > 0);
  const hasPartner = dto.partner_id != null || dto.partner != null;

  if (
    dto.sublet_name &&
    (dto.sublet_amount === undefined || dto.sublet_amount === null)
  ) {
    throw new BadRequestException(
      'sublet_amount is required when sublet_name is provided',
    );
  }
  if (dto.sublet_amount && !dto.sublet_name) {
    throw new BadRequestException(
      'sublet_name is required when sublet_amount is provided',
    );
  }
  if (hasPartner && !(dto.partner_amount && dto.partner_amount > 0)) {
    throw new BadRequestException(
      'partner_amount must be greater than zero when a partner is provided',
    );
  }
  if ((dto.partner_amount ?? 0) > 0 && !hasPartner) {
    throw new BadRequestException(
      'A partner is required when partner_amount is provided',
    );
  }
  if (hasSublet && dto.rider_id) {
    throw new BadRequestException('A sublet job cannot have a rider assigned');
  }
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListJobsDto) {
    const {
      page,
      limit,
      status,
      client_id,
      rider_id,
      partner_id,
      unpaid,
      has_sublet,
      has_partner,
      date_from,
      date_to,
    } = query;

    const where: Prisma.JobWhereInput = {
      account_id: user.accountId,
      ...(status && { status }),
      ...(client_id && { client_id }),
      ...(rider_id && { rider_id }),
      ...(partner_id && { partner_id }),
      ...(has_sublet !== undefined && {
        sublet_name: has_sublet ? { not: null } : null,
      }),
      ...(has_partner !== undefined && {
        partner_id: has_partner ? { not: null } : null,
      }),
      ...(date_from || date_to
        ? {
            job_date: {
              ...(date_from && { gte: new Date(date_from) }),
              ...(date_to && { lte: new Date(date_to) }),
            },
          }
        : {}),
      ...(unpaid && {
        payments: { none: {} },
        status: { notIn: ['cancelled'] },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { job_date: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          client: { select: { id: true, name: true } },
          rider: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
      }),
      this.prisma.job.count({ where }),
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
    const job = await this.prisma.job.findFirst({
      where: { id, account_id: user.accountId },
      include: {
        client: { select: { id: true, name: true } },
        rider: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
        payments: true,
        expenses: true,
      },
    });

    if (!job) throw new NotFoundException('Job not found');

    const received = job.payments.reduce((sum, p) => {
      return sum + (p.type === 'payment' ? p.amount : -p.amount);
    }, 0);

    const debt = job.total - received;
    const expenseTotal = job.expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = job.office_fee - expenseTotal;

    return {
      data: {
        ...job,
        received,
        debt,
        profit,
      },
    };
  }

  async create(user: AuthenticatedUser, dto: CreateJobDto) {
    const clientSelectionCount =
      [dto.client_id, dto.client_name].filter((value) => value !== undefined)
        .length + (dto.client != null ? 1 : 0);
    if (clientSelectionCount !== 1) {
      throw new BadRequestException(
        'Provide exactly one of client_id, client_name, or client',
      );
    }

    if (dto.partner_id != null && dto.partner != null) {
      throw new BadRequestException(
        'Provide either partner_id or partner, not both',
      );
    }
    if (
      (dto.client?.name.trim() ?? dto.client_name?.trim()) === '' ||
      dto.partner?.name.trim() === ''
    ) {
      throw new BadRequestException('Client and partner names cannot be blank');
    }

    validateJobRules(dto);

    const total = calcTotal({
      office_fee: dto.office_fee,
      sublet_amount: dto.sublet_amount,
      park_waybill: dto.park_waybill,
      partner_amount: dto.partner_amount,
    });

    try {
      const job = await this.prisma.$transaction(async (tx) => {
        let clientId: number;
        if (dto.client_id !== undefined) {
          const client = await tx.client.findFirst({
            where: { id: dto.client_id, account_id: user.accountId },
            select: { id: true },
          });
          if (!client) throw new NotFoundException('Client not found');
          clientId = client.id;
        } else {
          const clientName = dto.client?.name ?? dto.client_name;
          if (clientName === undefined) {
            throw new BadRequestException(
              'A client name is required when creating a client',
            );
          }
          const client = await tx.client.create({
            data: {
              name: clientName.trim(),
              phone: dto.client?.phone,
              notes: dto.client?.notes,
              account_id: user.accountId,
              user_id: user.userId,
            },
            select: { id: true },
          });
          clientId = client.id;
        }

        if (dto.rider_id !== undefined) {
          const rider = await tx.rider.findFirst({
            where: {
              id: dto.rider_id,
              account_id: user.accountId,
              active: true,
            },
            select: { id: true },
          });
          if (!rider)
            throw new NotFoundException('Rider not found or inactive');
        }

        let partner: { id: number; name: string } | null = null;
        if (dto.partner_id != null) {
          partner = await tx.partner.findFirst({
            where: {
              id: dto.partner_id,
              account_id: user.accountId,
              active: true,
            },
            select: { id: true, name: true },
          });
          if (!partner)
            throw new NotFoundException('Partner not found or inactive');
        } else if (dto.partner) {
          partner = await tx.partner.create({
            data: {
              name: dto.partner.name.trim(),
              phone: dto.partner.phone,
              email: dto.partner.email,
              notes: dto.partner.notes,
              account_id: user.accountId,
            },
            select: { id: true, name: true },
          });
        }

        return tx.job.create({
          data: {
            account_id: user.accountId,
            user_id: user.userId,
            client_id: clientId,
            rider_id: dto.rider_id ?? null,
            pickup: dto.pickup,
            dropoff: dto.dropoff,
            description: dto.description,
            ...(dto.job_date && { job_date: new Date(dto.job_date) }),
            office_fee: dto.office_fee,
            sublet_name: dto.sublet_name ?? null,
            sublet_amount: dto.sublet_amount ?? 0,
            park_waybill: dto.park_waybill ?? 0,
            partner_id: partner?.id ?? null,
            partner_name_snapshot: partner?.name ?? null,
            partner_amount: dto.partner_amount ?? 0,
            total,
          },
          include: { partner: { select: { id: true, name: true } } },
        });
      });

      return { message: 'Job created successfully', data: job };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dto.partner
      ) {
        throw new ConflictException('Partner already exists');
      }
      throw error;
    }
  }

  async update(id: number, user: AuthenticatedUser, dto: UpdateJobDto) {
    if (dto.status === 'cancelled') {
      throw new BadRequestException(
        'Use POST /jobs/:id/cancel to cancel a job',
      );
    }

    const existing = await this.prisma.job.findFirst({
      where: { id, account_id: user.accountId },
      include: { payments: true },
    });

    if (!existing) throw new NotFoundException('Job not found');
    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cannot edit a cancelled job');
    }

    const received = existing.payments.reduce((sum, p) => {
      return sum + (p.type === 'payment' ? p.amount : -p.amount);
    }, 0);

    const merged = {
      office_fee: dto.office_fee ?? existing.office_fee,
      sublet_name:
        ('sublet_name' in dto ? dto.sublet_name : existing.sublet_name) ??
        undefined,
      sublet_amount: dto.sublet_amount ?? existing.sublet_amount,
      park_waybill: dto.park_waybill ?? existing.park_waybill,
      partner_id: 'partner_id' in dto ? dto.partner_id : existing.partner_id,
      partner_amount:
        dto.partner_id === null
          ? (dto.partner_amount ?? 0)
          : (dto.partner_amount ?? existing.partner_amount),
      rider_id:
        ('rider_id' in dto ? dto.rider_id : existing.rider_id) ?? undefined,
    };

    validateJobRules(merged);

    let partnerNameSnapshot: string | undefined;
    if ('partner_id' in dto) {
      if (dto.partner_id == null) {
        partnerNameSnapshot = undefined;
      } else {
        const partner = await this.prisma.partner.findFirst({
          where: {
            id: dto.partner_id,
            account_id: user.accountId,
            active: true,
          },
          select: { id: true, name: true },
        });
        if (!partner)
          throw new NotFoundException('Partner not found or inactive');
        partnerNameSnapshot = partner.name;
      }
    }

    const newTotal = calcTotal(merged);

    if (newTotal < received) {
      throw new BadRequestException(
        `New total (${newTotal}) cannot be less than amount already received (${received})`,
      );
    }

    const job = await this.prisma.job.update({
      where: { id },
      data: {
        client_id: dto.client_id,
        rider_id: dto.rider_id,
        status: dto.status,
        pickup: dto.pickup,
        dropoff: dto.dropoff,
        description: dto.description,
        ...(dto.job_date && { job_date: new Date(dto.job_date) }),
        office_fee: dto.office_fee,
        sublet_amount: dto.sublet_amount,
        park_waybill: dto.park_waybill,
        partner_amount: dto.partner_amount,
        total: newTotal,
        sublet_name: merged.sublet_name ?? null,
        ...(dto.partner_id !== undefined && {
          partner_id: dto.partner_id,
          partner_name_snapshot: partnerNameSnapshot ?? null,
        }),
        ...(dto.partner_id === null &&
          dto.partner_amount === undefined && {
            partner_amount: 0,
          }),
      },
      include: { partner: { select: { id: true, name: true } } },
    });

    return { message: 'Job updated successfully', data: job };
  }

  async delete(id: number, user: AuthenticatedUser) {
    const job = await this.prisma.job.findFirst({
      where: { id, account_id: user.accountId },
      include: { payments: { take: 1 } },
    });

    if (!job) throw new NotFoundException('Job not found');
    if (job.payments.length > 0) {
      throw new BadRequestException('Cannot delete a job that has payments');
    }

    await this.prisma.job.delete({ where: { id } });

    return { message: 'Job deleted successfully' };
  }

  async cancel(id: number, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id, account_id: user.accountId },
        include: { payments: true },
      });

      if (!job) throw new NotFoundException('Job not found');
      if (job.status === 'cancelled') {
        throw new BadRequestException('Job is already cancelled');
      }

      const received = job.payments.reduce((sum, p) => {
        return sum + (p.type === 'payment' ? p.amount : -p.amount);
      }, 0);

      // Issue full refund if money was received
      if (received > 0) {
        await tx.payment.create({
          data: {
            job_id: id,
            type: 'refund',
            amount: received,
            mode: 'cash',
          },
        });
      }

      const updated = await tx.job.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      return { message: 'Job cancelled successfully', data: updated };
    });
  }
}
