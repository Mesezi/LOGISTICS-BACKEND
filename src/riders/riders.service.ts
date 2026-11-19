import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateRiderDto } from './dto/create-rider.dto.js';
import { ListRidersDto } from './dto/list-riders.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class RidersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, { query = '', page, limit, active }: ListRidersDto) {
    const where: Prisma.RiderWhereInput = {
      account_id: user.accountId,
      ...(active !== undefined && { active }),
      name: { contains: query, mode: 'insensitive' },
    };

    const [data, total] = await Promise.all([
      this.prisma.rider.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.rider.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const rider = await this.prisma.rider.findFirst({
      where: { id, account_id: user.accountId },
    });

    if (!rider) throw new NotFoundException('Rider not found');

    return { data: rider };
  }

  async create(user: AuthenticatedUser, dto: CreateRiderDto) {
    const rider = await this.prisma.rider.create({
      data: {
        ...dto,
        account_id: user.accountId,
      },
    });

    return { message: 'Rider created successfully', data: rider };
  }

  async update(id: number, user: AuthenticatedUser, dto: Partial<CreateRiderDto> & { active?: boolean }) {
    const rider = await this.prisma.rider.update({
      where: { id, account_id: user.accountId },
      data: dto,
    });

    return { message: 'Rider updated successfully', data: rider };
  }
}
