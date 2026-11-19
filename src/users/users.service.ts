import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async invite(user: AuthenticatedUser, dto: InviteUserDto) {
    const existing = await this.prisma.invitation.findFirst({
      where: {
        account_id: user.accountId,
        email: dto.email,
        status: 'pending',
      },
    });

    if (existing) {
      throw new BadRequestException('A pending invitation already exists for this email');
    }

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + INVITE_EXPIRY_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        account_id: user.accountId,
        invited_by_id: user.userId,
        email: dto.email,
        role: dto.role,
        token: crypto.randomUUID(),
        expires_at,
      },
    });

    // TODO: send invitation email with invitation.token

    return {
      message: 'Invitation sent',
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    };
  }
}
