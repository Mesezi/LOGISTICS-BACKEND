import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  const prisma = {
    $queryRaw: vi.fn(),
    client: { findFirst: vi.fn() },
  };
  const user: AuthenticatedUser = {
    userId: 7,
    accountId: 3,
    role: 'staff',
    clerkId: 'clerk-user',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('returns daily summary values as JSON numbers', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        jobCount: 2n,
        deliveredJobs: 1n,
        failedJobs: 0n,
        cancelledJobs: 1n,
        officeFees: 1000n,
        subletFees: 0n,
        partnerAndWaybillFees: 0n,
        paymentsReceived: 500n,
        refundsIssued: 100n,
        expenses: 50n,
      },
    ]);

    await expect(
      service.daily(user, { date: '2026-11-18' }),
    ).resolves.toEqual({
      date: '2026-11-18',
      jobCount: 2,
      deliveredJobs: 1,
      failedJobs: 0,
      cancelledJobs: 1,
      officeFees: 1000,
      subletFees: 0,
      partnerAndWaybillFees: 0,
      paymentsReceived: 500,
      refundsIssued: 100,
      expenses: 50,
    });
  });

  it('rejects invalid date ranges before querying reports', async () => {
    await expect(
      service.income(user, {
        start_date: '2026-11-19',
        end_date: '2026-11-18',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('calculates client statement balances and keeps expenses informational', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 12,
      name: 'Client',
      phone: null,
    });
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          date: new Date('2026-11-18T00:00:00.000Z'),
          type: 'job',
          recordId: 21,
          description: 'Job charge',
          amount: 1000,
          balanceChange: 1000,
        },
        {
          date: new Date('2026-11-18T00:00:00.000Z'),
          type: 'payment',
          recordId: 33,
          description: 'Payment',
          amount: 400,
          balanceChange: -400,
        },
        {
          date: new Date('2026-11-18T00:00:00.000Z'),
          type: 'expense',
          recordId: 44,
          description: 'Delivery expense',
          amount: 25,
          balanceChange: 0,
        },
      ])
      .mockResolvedValueOnce([{ balance: 200n }]);

    const result = await service.clientStatement(user, {
      client_id: 12,
      start_date: '2026-11-18',
      end_date: '2026-11-18',
    });

    expect(result.summary).toEqual({
      openingBalance: 200,
      jobCharges: 1000,
      payments: 400,
      refunds: 0,
      expenses: 25,
      closingBalance: 800,
    });
    expect(result.data).toHaveLength(3);
  });
});
