import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PartnersService } from './partners.service.js';

describe('PartnersService', () => {
  let service: PartnersService;
  const prisma = {
    partner: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
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
        PartnersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<PartnersService>(PartnersService);
  });

  it('lists partners scoped to the current account and paginates results', async () => {
    prisma.partner.findMany.mockResolvedValue([]);
    prisma.partner.count.mockResolvedValue(0);

    await service.list(user, {
      query: '',
      active: false,
      page: 1,
      limit: 50,
    });

    expect(prisma.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          account_id: 3,
          active: false,
          name: { contains: '', mode: 'insensitive' },
        },
        take: 50,
        skip: 0,
      }),
    );
  });

  it('trims partner names and creates them under the authenticated account', async () => {
    prisma.partner.findFirst.mockResolvedValue(null);
    prisma.partner.create.mockResolvedValue({ id: 8, account_id: 3, name: 'Partner A' });

    await service.create(user, { name: ' Partner A ' });

    expect(prisma.partner.create).toHaveBeenCalledWith({
      data: { name: 'Partner A', account_id: 3 },
    });
  });

  it('rejects duplicate names regardless of case', async () => {
    prisma.partner.findFirst.mockResolvedValue({ id: 8 });

    await expect(
      service.create(user, { name: 'partner a' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.partner.create).not.toHaveBeenCalled();
  });

  it('does not return partners from another account', async () => {
    prisma.partner.findFirst.mockResolvedValue(null);

    await expect(service.findOne(8, user)).rejects.toThrow(NotFoundException);
    expect(prisma.partner.findFirst).toHaveBeenCalledWith({
      where: { id: 8, account_id: 3 },
    });
  });

  it('maps database name-uniqueness races to a conflict', async () => {
    prisma.partner.findFirst.mockResolvedValue(null);
    prisma.partner.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate name', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(user, { name: 'Partner A' }),
    ).rejects.toThrow(ConflictException);
  });
});
