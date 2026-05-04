import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListTransactionsDto } from './dto/list-transactions.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    async listTransactions(filters: AdminListTransactionsDto) {
        // Parse pagination with safe defaults and a hard cap
        const page = Math.max(1, parseInt(filters.page ?? '1', 10) || 1);
        const requestedLimit = parseInt(filters.limit ?? '25', 10) || 25;
        const limit = Math.min(100, Math.max(1, requestedLimit));
        const skip = (page - 1) * limit;

        // Build the WHERE clause from optional filters
        const where: Prisma.TransactionWhereInput = {};

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.userEmail) {
            where.user = {
                email: { contains: filters.userEmail, mode: 'insensitive' },
            };
        }

        if (filters.fromDate || filters.toDate) {
            where.createdAt = {};
            if (filters.fromDate) {
                where.createdAt.gte = new Date(filters.fromDate);
            }
            if (filters.toDate) {
                where.createdAt.lte = new Date(filters.toDate);
            }
        }

        if (filters.minAmount || filters.maxAmount) {
            where.sendAmount = {};
            if (filters.minAmount) {
                where.sendAmount.gte = new Prisma.Decimal(filters.minAmount);
            }
            if (filters.maxAmount) {
                where.sendAmount.lte = new Prisma.Decimal(filters.maxAmount);
            }
        }

        // Run the count and the page query in parallel for speed
        const [total, transactions] = await this.prisma.$transaction([
            this.prisma.transaction.count({ where }),
            this.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: { id: true, email: true, fullName: true },
                    },
                    recipient: {
                        select: {
                            id: true,
                            fullName: true,
                            sortCode: true,
                            accountNumber: true,
                            bankName: true,
                        },
                    },
                },
            }),
        ]);

        return {
            data: transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}