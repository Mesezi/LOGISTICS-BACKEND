import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { SearchService } from './search.service.js';

describe('SearchService', () => {
  let service: SearchService;
  const prisma = {
    $queryRaw: vi.fn(),
  };
  const user: AuthenticatedUser = {
    userId: 7,
    accountId: 3,
    role: 'staff',
    clerkId: 'clerk-user',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([
      { name: 'Access Bank', usage_count: 5n },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('returns bank suggestions with numeric usage counts', async () => {
    await expect(service.banks(user, ' access ')).resolves.toEqual({
      data: [{ name: 'Access Bank', usageCount: 5 }],
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns location suggestions with numeric usage counts', async () => {
    await expect(service.locations(user, ' ikeja ')).resolves.toEqual({
      data: [{ name: 'Access Bank', usageCount: 5 }],
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('does not query the database for a blank search term', async () => {
    await expect(service.banks(user, '   ')).resolves.toEqual({ data: [] });
    await expect(service.locations(user, '   ')).resolves.toEqual({ data: [] });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
