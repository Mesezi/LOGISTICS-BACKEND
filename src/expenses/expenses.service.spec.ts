import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExpensesService } from './expenses.service.js';

describe('ExpensesService', () => {
  let service: ExpensesService;
  const prisma = {
    expense: {
      findFirst: vi.fn(),
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
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<ExpensesService>(ExpensesService);
  });

  it('finds an expense by id within the current account with related summaries', async () => {
    const expense = { id: 12, account_id: 3 };
    prisma.expense.findFirst.mockResolvedValue(expense);

    await expect(service.findOne(12, user)).resolves.toEqual({ data: expense });
    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: { id: 12, account_id: 3 },
      include: {
        rider: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        job: { select: { id: true, pickup: true, dropoff: true, job_date: true } },
      },
    });
  });

  it('returns not found when the expense is missing or belongs to another account', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(service.findOne(12, user)).rejects.toThrow(NotFoundException);
    expect(prisma.expense.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12, account_id: 3 } }),
    );
  });
});
