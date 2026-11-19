import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

function getDateBoundary(value: string, isEndDate: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${isEndDate ? '23:59:59.999' : '00:00:00.000'}Z`);
  }

  return new Date(value);
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListAuditLogsDto) {
    const {
      page,
      limit,
      table_name,
      record_id,
      start_date,
      end_date,
    } = query;
    const startDate = start_date
      ? getDateBoundary(start_date, false)
      : undefined;
    const endDate = end_date ? getDateBoundary(end_date, true) : undefined;

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    const where: Prisma.AuditLogWhereInput = {
      account_id: user.accountId,
      ...(table_name && { table_name }),
      ...(record_id !== undefined && { record_id }),
      ...(startDate || endDate
        ? {
            created_at: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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
}
