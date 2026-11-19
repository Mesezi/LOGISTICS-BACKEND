import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ALLOW_UNREGISTERED_KEY } from './allow-unregistered.decorator.js';
import { UserRole } from '../generated/prisma/client.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    clerkId: string;
    sessionId?: string;
    userId?: number;
    accountId?: number;
    role?: UserRole;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) return true

    const allowUnregistered = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNREGISTERED_KEY,
      [context.getHandler(), context.getClass()],
    );


    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.split(' ')[1];

    const claims = await this.authService.verifyClerkToken(token);

    if (allowUnregistered) {
      request.user = {
        clerkId: claims.sub,
        sessionId: claims.sid,
      };
      return true;
    }

    let user = await this.prisma.user.findUnique({
      where: {clerk_id: claims.sub}
    });

    if (!user) {
      throw new UnauthorizedException('User not registered');
    }

    request.user = {
      clerkId: claims.sub,
      sessionId: claims.sid,
      userId: user.id,
      accountId: user.account_id!,
      role: user.role
    };

    return true;
  }
}