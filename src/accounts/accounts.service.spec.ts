import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = {
    account: {
      update: vi.fn(),
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AccountsService>(AccountsService);
  });

  it('updates only the authenticated user account and returns its settings', async () => {
    const account = { id: 3, name: 'Updated', image_url: null };
    prisma.account.update.mockResolvedValue(account);

    await expect(
      service.update(user, { name: 'Updated' }),
    ).resolves.toEqual({ data: account });
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'Updated' },
      select: {
        id: true,
        name: true,
        image_url: true,
        created_at: true,
        updated_at: true,
      },
    });
  });

  it('allows clearing the account image', async () => {
    prisma.account.update.mockResolvedValue({ id: 3, image_url: null });

    await service.update(user, { image_url: null });

    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { image_url: null } }),
    );
  });

  it('rejects an empty update', async () => {
    await expect(service.update(user, {})).rejects.toThrow(BadRequestException);
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it('returns not found when the account row no longer exists', async () => {
    prisma.account.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.update(user, { name: 'Updated' }),
    ).rejects.toThrow(NotFoundException);
  });
});
