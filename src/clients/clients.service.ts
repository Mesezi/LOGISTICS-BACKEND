import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListClientsDto } from './dto/list-clients.dto.js';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class ClientsService {
    constructor(private readonly prisma: PrismaService) { }

    async list(user: AuthenticatedUser, { query = '', page, limit, mine }: ListClientsDto) {

        const where = {
            account_id: user.accountId,
            ...(mine && { user_id: user.userId }),
            name: { contains: query, mode: 'insensitive' as const }
        }

        const [data, total] = await Promise.all([
            this.prisma.client.findMany({
                where,
                orderBy: { name: 'asc' },
                take: limit,
                skip: (page - 1) * limit,
            }),

            this.prisma.client.count({ where }),
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


    async create(user: AuthenticatedUser, dto: CreateClientDto) {

        const client = await this.prisma.client.create({
            data: {
                ...dto,
                account_id: user.accountId,
                user_id: user.userId,
            },
        });

        return {
            message: 'Client created successfully',
            data: client,
        };

    }


    async update(id: number, user: AuthenticatedUser, dto: Partial<CreateClientDto>) {

        const client = await this.prisma.client.update({
            where: {
                id,
                account_id: user.accountId,
            },
            data: dto,
        });

        return {
            message: 'Client updated successfully',
            data: client,
        };

    }

    async delete(id: number, user: AuthenticatedUser) {
        try {
            await this.prisma.client.delete({
                where: {
                    id,
                    account_id: user.accountId,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException('Client not found');
            }

            throw error;
        }

        return {
            message: 'Client deleted successfully',
        };
    }


    async findOne(id: number, user: AuthenticatedUser) {
        const client = await this.prisma.client.findFirst({
            where: {
                id,
                account_id: user.accountId,
            },
        });

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        return {
            data: client,
        };
    }



}
