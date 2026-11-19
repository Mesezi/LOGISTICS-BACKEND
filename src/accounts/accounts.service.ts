import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async update(user: AuthenticatedUser, dto: UpdateAccountDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'At least one account setting must be provided',
      );
    }

    try {
      const account = await this.prisma.account.update({
        where: { id: user.accountId },
        data: dto,
        select: {
          id: true,
          name: true,
          image_url: true,
          created_at: true,
          updated_at: true,
        },
      });

      return { data: account };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Account not found');
      }

      throw error;
    }
  }
}
