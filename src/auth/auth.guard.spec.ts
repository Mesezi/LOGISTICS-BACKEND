import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { ALLOW_UNREGISTERED_KEY } from './allow-unregistered.decorator.js';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  const request = {
    headers: { authorization: 'Bearer clerk-session-token' },
    user: undefined as
      | {
          clerkId: string;
          sessionId?: string;
          userId?: number;
          accountId?: number;
          role?: string;
        }
      | undefined,
  };
  const authService = {
    verifyClerkToken: vi.fn(),
  };
  const prisma = {
    user: { findUnique: vi.fn() },
  };
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const guard = new AuthGuard(
    authService as unknown as AuthService,
    prisma as unknown as PrismaService,
    reflector as unknown as Reflector,
  );
  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    request.user = undefined;
    authService.verifyClerkToken.mockResolvedValue({
      sub: 'clerk-user-id',
      sid: 'clerk-session-id',
    });
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ALLOW_UNREGISTERED_KEY) return true;
      return false;
    });
  });

  it('authenticates unregistered Clerk users on marked onboarding endpoints', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(authService.verifyClerkToken).toHaveBeenCalledWith(
      'clerk-session-token',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(request.user).toEqual({
      clerkId: 'clerk-user-id',
      sessionId: 'clerk-session-id',
    });
  });

  it('marks registration and invitation acceptance as onboarding endpoints', () => {
    const registerHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'register',
    )?.value;
    const acceptInvitationHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'acceptInvitation',
    )?.value;

    expect(
      Reflect.getMetadata(ALLOW_UNREGISTERED_KEY, registerHandler),
    ).toBe(true);
    expect(
      Reflect.getMetadata(ALLOW_UNREGISTERED_KEY, acceptInvitationHandler),
    ).toBe(true);
  });

  it('still rejects users without a database record on ordinary protected routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ALLOW_UNREGISTERED_KEY) return false;
      return false;
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('User not registered'),
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerk_id: 'clerk-user-id' },
    });
  });
});
