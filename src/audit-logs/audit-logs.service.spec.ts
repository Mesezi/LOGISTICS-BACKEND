import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { AuditLogsService } from './audit-logs.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  const prisma = {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  const user: AuthenticatedUser = {
    userId: 7,
    accountId: 3,
    role: 'admin',
    clerkId: 'clerk-user',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('filters by account, record fields, and inclusive date-only boundaries', async () => {
    const query = Object.assign(new ListAuditLogsDto(), {
      page: 2,
      limit: 10,
      table_name: 'jobs',
      record_id: 42,
      start_date: '2026-11-01',
      end_date: '2026-11-18',
    });

    await service.list(user, query);

    const expectedWhere = {
      account_id: 3,
      table_name: 'jobs',
      record_id: 42,
      created_at: {
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lte: new Date('2026-11-18T23:59:59.999Z'),
      },
    };
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 10,
      skip: 10,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('rejects a date range whose start is after its end', async () => {
    const query = Object.assign(new ListAuditLogsDto(), {
      start_date: '2026-11-19',
      end_date: '2026-11-18',
    });

    await expect(service.list(user, query)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
  });

  it('returns paginated data and metadata', async () => {
    prisma.auditLog.count.mockResolvedValue(21);
    const query = Object.assign(new ListAuditLogsDto(), {
      page: 2,
      limit: 10,
    });

    await expect(service.list(user, query)).resolves.toEqual({
      data: [],
      meta: {
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });
});
