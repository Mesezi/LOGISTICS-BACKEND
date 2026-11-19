import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { ReportsService } from './reports.service.js';
import ExcelJS from 'exceljs';

describe('ReportsService', () => {
  let service: ReportsService;
  const prisma = {
    $queryRaw: vi.fn(),
    client: { findFirst: vi.fn() },
    payment: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
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

  it('exports daily payments net of refunds and separates expense categories', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        type: 'payment',
        amount: 5000,
        mode: 'transfer',
        bank_name: 'FCMB',
        job: {
          id: 21,
          client: { name: 'Example Client' },
          rider: { name: 'Rider One' },
          partner: null,
          partner_name_snapshot: null,
          rider_id: 4,
          pickup: 'Ikeja',
          dropoff: 'Lekki',
          sublet_name: null,
          sublet_amount: 0,
          park_waybill: 500,
          office_fee: 4500,
          partner_amount: 0,
        },
      },
      {
        type: 'refund',
        amount: 1000,
        mode: 'cash',
        bank_name: null,
        job: {
          id: 21,
          client: { name: 'Example Client' },
          rider: { name: 'Rider One' },
          partner: null,
          partner_name_snapshot: null,
          rider_id: 4,
          pickup: 'Ikeja',
          dropoff: 'Lekki',
          sublet_name: null,
          sublet_amount: 0,
          park_waybill: 500,
          office_fee: 4500,
          partner_amount: 0,
        },
      },
    ]);
    prisma.expense.findMany.mockResolvedValue([
      {
        description: 'Fuel',
        amount: 700,
        mode: 'cash',
        bank_name: null,
        owner: 'rider',
        rider: { name: 'Rider One' },
        client: null,
        job: {
          id: 21,
          client: { name: 'Example Client' },
          rider: { name: 'Rider One' },
          partner: null,
          partner_name_snapshot: null,
          rider_id: 4,
          pickup: 'Ikeja',
          dropoff: 'Lekki',
          sublet_name: null,
          sublet_amount: 0,
          park_waybill: 500,
          office_fee: 4500,
          partner_amount: 0,
        },
      },
      {
        description: 'Office internet',
        amount: 2000,
        mode: 'transfer',
        bank_name: 'KUDA',
        owner: 'office',
        rider: null,
        client: null,
        job: null,
      },
    ]);

    const { date, buffer } = await service.dailyExcel(user, {
      date: '2026-11-18',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Daily Sheet');

    expect(date).toBe('2026-11-18');
    expect(sheet?.getRow(1).values).toEqual(
      expect.arrayContaining(['Income', 'Rider expenses', 'Office expenses']),
    );
    expect(sheet?.getRow(2).values).toEqual(
      expect.arrayContaining([
        '2026-11-18',
        'Example Client',
        'Ikeja → Lekki',
        -1000 + 5000,
        'FCMB, Cash',
        'Rider One',
        4500,
        0,
        500,
        0,
        '',
        0,
        'Fuel',
        'Cash',
        700,
        0,
        0,
      ]),
    );
    expect(sheet?.getRow(3).values).toEqual(
      expect.arrayContaining([
        'Office internet',
        'KUDA',
        0,
        2000,
        0,
      ]),
    );

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          paid_at: new Date('2026-11-18T00:00:00.000Z'),
          job: { account_id: 3 },
        },
      }),
    );
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          account_id: 3,
          expense_date: new Date('2026-11-18T00:00:00.000Z'),
        },
      }),
    );
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
