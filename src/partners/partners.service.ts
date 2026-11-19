import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { ListPartnersDto } from './dto/list-partners.dto.js';
import { UpdatePartnerDto } from './dto/update-partner.dto.js';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListPartnersDto) {
    const where: Prisma.PartnerWhereInput = {
      account_id: user.accountId,
      ...(query.active !== undefined && { active: query.active }),
      name: { contains: query.query.trim(), mode: 'insensitive' },
    };

    const [data, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        orderBy: { name: 'asc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUser) {
    const partner = await this.prisma.partner.findFirst({
      where: { id, account_id: user.accountId },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return { data: partner };
  }

  async create(user: AuthenticatedUser, dto: CreatePartnerDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.partner.findFirst({
      where: {
        account_id: user.accountId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Partner already exists');

    try {
      const partner = await this.prisma.partner.create({
        data: {
          name,
          phone: dto.phone,
          email: dto.email,
          notes: dto.notes,
          account_id: user.accountId,
        },
      });
      return { message: 'Partner created successfully', data: partner };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Partner already exists');
      }
      throw error;
    }
  }

  async update(id: number, user: AuthenticatedUser, dto: UpdatePartnerDto) {
    const existing = await this.prisma.partner.findFirst({
      where: { id, account_id: user.accountId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Partner not found');

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one partner field must be provided');
    }

    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.partner.findFirst({
        where: {
          account_id: user.accountId,
          id: { not: id },
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Partner already exists');
    }

    try {
      const partner = await this.prisma.partner.update({
        where: { id, account_id: user.accountId },
        data: {
          name,
          phone: dto.phone,
          email: dto.email,
          notes: dto.notes,
          active: dto.active,
        },
      });
      return { message: 'Partner updated successfully', data: partner };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Partner already exists');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Partner not found');
      }
      throw error;
    }
  }
}
