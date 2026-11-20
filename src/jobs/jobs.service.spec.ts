import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobsService } from './jobs.service.js';

describe('JobsService partner assignment', () => {
  let service: JobsService;
  const prisma = {
    $transaction: vi.fn(),
    client: { findFirst: vi.fn(), create: vi.fn() },
    rider: { findFirst: vi.fn() },
    partner: { findFirst: vi.fn(), create: vi.fn() },
    job: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  const user: AuthenticatedUser = {
    userId: 7,
    accountId: 3,
    role: 'staff',
    clerkId: 'clerk-user',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    prisma.client.findFirst.mockResolvedValue({ id: 12 });
    prisma.client.create.mockResolvedValue({ id: 12 });
    prisma.partner.findFirst.mockResolvedValue({ id: 9, name: 'Partner A' });
    prisma.partner.create.mockResolvedValue({ id: 10, name: 'New Partner' });
    prisma.job.create.mockResolvedValue({ id: 21 });
    prisma.job.findFirst.mockResolvedValue({
      id: 21,
      account_id: 3,
      status: 'pending',
      office_fee: 5000,
      sublet_name: null,
      sublet_amount: 0,
      park_waybill: 0,
      partner_id: null,
      partner_amount: 0,
      rider_id: null,
      payments: [],
    });
    prisma.job.update.mockResolvedValue({ id: 21, status: 'picked_up' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<JobsService>(JobsService);
  });

  it('validates partner ownership, records its name snapshot, and includes it in the response', async () => {
    await service.create(user, {
      client_id: 12,
      pickup: 'Ikeja',
      dropoff: 'Lekki',
      office_fee: 5000,
      partner_id: 9,
      partner_amount: 500,
    });

    expect(prisma.partner.findFirst).toHaveBeenCalledWith({
      where: { id: 9, account_id: 3, active: true },
      select: { id: true, name: true },
    });
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 3,
          partner_id: 9,
          partner_name_snapshot: 'Partner A',
          partner_amount: 500,
          total: 5500,
        }),
        include: { partner: { select: { id: true, name: true } } },
      }),
    );
  });

  it('rejects a partner id that is not active in the current account', async () => {
    prisma.partner.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        client_id: 12,
        pickup: 'Ikeja',
        dropoff: 'Lekki',
        office_fee: 5000,
        partner_id: 9,
        partner_amount: 500,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('requires a partner id whenever partner amount is positive', async () => {
    await expect(
      service.create(user, {
        client_id: 12,
        pickup: 'Ikeja',
        dropoff: 'Lekki',
        office_fee: 5000,
        partner_amount: 500,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('creates a client and partner with the job in the same transaction', async () => {
    await service.create(user, {
      client: {
        name: 'New Client',
        phone: '+2348000000000',
        notes: 'Deliveries accepted weekdays',
      },
      partner: {
        name: ' New Partner ',
        phone: '+2348111111111',
        email: 'partner@example.com',
        notes: 'Primary dispatch partner',
      },
      pickup: 'Ikeja',
      dropoff: 'Lekki',
      office_fee: 5000,
      partner_amount: 500,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        name: 'New Client',
        phone: '+2348000000000',
        notes: 'Deliveries accepted weekdays',
        account_id: 3,
        user_id: 7,
      },
      select: { id: true },
    });
    expect(prisma.partner.create).toHaveBeenCalledWith({
      data: {
        name: 'New Partner',
        phone: '+2348111111111',
        email: 'partner@example.com',
        notes: 'Primary dispatch partner',
        account_id: 3,
      },
      select: { id: true, name: true },
    });
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          client_id: 12,
          partner_id: 10,
          partner_name_snapshot: 'New Partner',
          partner_amount: 500,
          total: 5500,
        }),
      }),
    );
  });

  it('rejects both existing and inline client selections', async () => {
    await expect(
      service.create(user, {
        client_id: 12,
        client: { name: 'New Client' },
        pickup: 'Ikeja',
        dropoff: 'Lekki',
        office_fee: 5000,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects both existing and inline partner selections', async () => {
    await expect(
      service.create(user, {
        client_id: 12,
        partner_id: 9,
        partner: { name: 'New Partner' },
        partner_amount: 500,
        pickup: 'Ikeja',
        dropoff: 'Lekki',
        office_fee: 5000,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates a job status through PATCH', async () => {
    await service.update(21, user, { status: 'picked_up' });

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21 },
        data: expect.objectContaining({ status: 'picked_up' }),
      }),
    );
  });

  it('requires the cancel endpoint to cancel a job', async () => {
    await expect(
      service.update(21, user, { status: 'cancelled' }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
