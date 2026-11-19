
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  verifyToken,
  createClerkClient,
} from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

interface ClerkClaims {
  sub: string;
  sid?: string;
}

@Injectable()
export class AuthService {
private readonly configService: ConfigService;
private readonly clerkClient;

constructor(configService: ConfigService, private readonly prisma: PrismaService) {
  this.configService = configService;

  this.clerkClient = createClerkClient({
    secretKey: this.configService.getOrThrow<string>(
      'CLERK_SECRET_KEY',
    ),
  });
}

  async verifyClerkToken(token: string): Promise<ClerkClaims> {
    const secretKey = this.configService.get<string>(
      'CLERK_SECRET_KEY',
    );

    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }

    try {
      const claims = await verifyToken(token, {
        secretKey,
        authorizedParties: ['http://localhost:3000'],
      });

      if (!claims.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      return claims as ClerkClaims;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }



  async syncUser(clerkId: string) {
    const clerkUser = await this.clerkClient.users.getUser(clerkId);

    const email =
      clerkUser.emailAddresses.find(
        (item) => item.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? null;

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || null;

    const image_url = clerkUser.imageUrl ?? null;

    return this.prisma.user.update({
      where: { clerk_id: clerkId },
      data: { name, email, image_url },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            image_url: true,
          },
        },
      },
    });
  }

  async register(clerkId: string, dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { clerk_id: clerkId },
    });

    if (existing?.account_id) {
      throw new BadRequestException('User is already registered to an account');
    }

    const clerkUser = await this.clerkClient.users.getUser(clerkId);

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? null;

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || null;

    const image_url = clerkUser.imageUrl ?? null;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { name: dto.account_name },
      });

      const user = await tx.user.upsert({
        where: { clerk_id: clerkId },
        create: {
          clerk_id: clerkId,
          account_id: account.id,
          name,
          email,
          image_url,
          role: 'admin',
        },
        update: {
          account_id: account.id,
          name,
          email,
          image_url,
          role: 'admin',
        },
      });

      return { account, user };
    });
  }

  async acceptInvitation(clerkId: string, dto: AcceptInvitationDto) {
    const existing = await this.prisma.user.findUnique({
      where: { clerk_id: clerkId },
    });

    if (existing?.account_id) {
      throw new BadRequestException('User is already registered to an account');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const clerkUser = await this.clerkClient.users.getUser(clerkId);

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? null;

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || null;

    const image_url = clerkUser.imageUrl ?? null;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { clerk_id: clerkId },
        create: {
          clerk_id: clerkId,
          account_id: invitation.account_id,
          name,
          email,
          image_url,
          role: invitation.role,
        },
        update: {
          account_id: invitation.account_id,
          name,
          email,
          image_url,
          role: invitation.role,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', accepted_at: new Date() },
      });

      return { user };
    });
  }
}
