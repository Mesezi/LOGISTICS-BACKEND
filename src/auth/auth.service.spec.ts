import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const clerkUser = vi.hoisted(() => ({
  emailAddresses: [
    { id: 'email-primary', emailAddress: 'user@example.com' },
  ],
  primaryEmailAddressId: 'email-primary',
  firstName: 'Example',
  lastName: 'User',
  imageUrl: null,
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    users: { getUser: vi.fn().mockResolvedValue(clerkUser) },
  })),
  verifyToken: vi.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: { update: vi.fn() },
  };
  const configGet = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    configGet.mockImplementation((key: string) => {
      if (key === 'CLERK_SECRET_KEY') return 'clerk-secret';
      if (key === 'FRONTEND_ORIGINS') {
        return 'http://localhost:3000, https://blu-logistics.vercel.app';
      }
      return undefined;
    });
    service = new AuthService(
      {
        getOrThrow: vi.fn().mockReturnValue('clerk-secret'),
        get: configGet,
      } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('uses configured frontend origins as Clerk authorized parties', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      sub: 'clerk-user-id',
      sid: 'clerk-session-id',
    });

    await expect(
      service.verifyClerkToken('session-token'),
    ).resolves.toEqual({
      sub: 'clerk-user-id',
      sid: 'clerk-session-id',
    });

    expect(verifyToken).toHaveBeenCalledWith('session-token', {
      secretKey: 'clerk-secret',
      authorizedParties: [
        'http://localhost:3000',
        'https://blu-logistics.vercel.app',
      ],
    });
  });

  it('syncs the Clerk profile and returns the account summary', async () => {
    const userWithAccount = {
      id: 7,
      account_id: 3,
      name: 'Example User',
      email: 'user@example.com',
      image_url: null,
      account: { id: 3, name: 'Acme Logistics', image_url: null },
    };
    prisma.user.update.mockResolvedValue(userWithAccount);

    await expect(service.syncUser('clerk-user-id')).resolves.toEqual(
      userWithAccount,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { clerk_id: 'clerk-user-id' },
      data: {
        name: 'Example User',
        email: 'user@example.com',
        image_url: null,
      },
      include: {
        account: {
          select: { id: true, name: true, image_url: true },
        },
      },
    });
  });
});
