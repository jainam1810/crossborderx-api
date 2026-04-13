import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecipientsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Add a new recipient (someone you want to send money to).
     * Validates UK sort code (6 digits) and account number (8 digits).
     */
    async create(userId: string, dto: {
        fullName: string;
        sortCode: string;
        accountNumber: string;
        bankName?: string;
    }) {
        // Clean sort code — remove dashes/spaces (user might type "12-34-56")
        const cleanSortCode = dto.sortCode.replace(/[-\s]/g, '');
        const cleanAccountNumber = dto.accountNumber.replace(/\s/g, '');

        // Validate UK sort code: exactly 6 digits
        if (!/^\d{6}$/.test(cleanSortCode)) {
            throw new BadRequestException('Sort code must be 6 digits (e.g. 123456 or 12-34-56)');
        }

        // Validate UK account number: exactly 8 digits
        if (!/^\d{8}$/.test(cleanAccountNumber)) {
            throw new BadRequestException('Account number must be 8 digits');
        }

        const recipient = await this.prisma.recipient.create({
            data: {
                userId,
                fullName: dto.fullName,
                sortCode: cleanSortCode,
                accountNumber: cleanAccountNumber,
                bankName: dto.bankName || null,
            },
        });

        return {
            id: recipient.id,
            fullName: recipient.fullName,
            sortCode: recipient.sortCode,
            accountNumber: recipient.accountNumber,
            bankName: recipient.bankName,
        };
    }

    /**
     * Get all recipients for a user.
     */
    async findAll(userId: string) {
        return this.prisma.recipient.findMany({
            where: { userId },
            select: {
                id: true,
                fullName: true,
                sortCode: true,
                accountNumber: true,
                bankName: true,
                country: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a single recipient (and verify it belongs to this user).
     */
    async findOne(userId: string, recipientId: string) {
        const recipient = await this.prisma.recipient.findFirst({
            where: { id: recipientId, userId },
        });

        if (!recipient) {
            throw new NotFoundException('Recipient not found');
        }

        return recipient;
    }

    /**
     * Delete a recipient.
     */
    async delete(userId: string, recipientId: string) {
        const recipient = await this.findOne(userId, recipientId);

        await this.prisma.recipient.delete({
            where: { id: recipient.id },
        });

        return { message: 'Recipient deleted' };
    }
}