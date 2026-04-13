import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

interface LedgerEntryInput {
    accountCode: string;
    entryType: 'DEBIT' | 'CREDIT';
    amount: number;
    currency: string;
    description: string;
}

@Injectable()
export class LedgerService {
    constructor(private prisma: PrismaService) { }

    async recordJournal(transactionId: string, entries: LedgerEntryInput[]): Promise<string> {
        // RULE 1: Debits must equal credits
        const totalDebits = entries
            .filter(e => e.entryType === 'DEBIT')
            .reduce((sum, e) => sum + e.amount, 0);
        const totalCredits = entries
            .filter(e => e.entryType === 'CREDIT')
            .reduce((sum, e) => sum + e.amount, 0);

        if (Math.abs(totalDebits - totalCredits) > 0.000001) {
            throw new BadRequestException(
                `LEDGER IMBALANCE REJECTED: debits=${totalDebits} credits=${totalCredits}`
            );
        }

        const journalId = randomUUID();

        await this.prisma.$transaction(async (tx) => {
            for (const entry of entries) {
                const account = await tx.ledgerAccount.findUnique({
                    where: { code: entry.accountCode },
                });

                if (!account) {
                    throw new BadRequestException(`Ledger account not found: ${entry.accountCode}`);
                }

                if (!account.isActive) {
                    throw new BadRequestException(`Ledger account is inactive: ${entry.accountCode}`);
                }

                const currentBalance = Number(account.balance);
                let balanceChange: number;

                if (account.type === 'ASSET' || account.type === 'EXPENSE') {
                    balanceChange = entry.entryType === 'DEBIT' ? entry.amount : -entry.amount;
                } else {
                    balanceChange = entry.entryType === 'CREDIT' ? entry.amount : -entry.amount;
                }

                const newBalance = currentBalance + balanceChange;

                // RULE: Asset accounts cannot go negative
                if (account.type === 'ASSET' && newBalance < -0.01) {
                    throw new BadRequestException(
                        `Insufficient balance in ${entry.accountCode}: current=${currentBalance}, change=${balanceChange}, would be=${newBalance}`
                    );
                }

                // Append-only: INSERT, never update or delete entries
                await tx.ledgerEntry.create({
                    data: {
                        transactionId,
                        journalId,
                        accountCode: entry.accountCode,
                        entryType: entry.entryType,
                        amount: entry.amount,
                        currency: entry.currency,
                        description: entry.description,
                    },
                });

                await tx.ledgerAccount.update({
                    where: { code: entry.accountCode },
                    data: { balance: newBalance },
                });
            }
        });

        return journalId;
    }

    async getBalance(accountCode: string): Promise<number> {
        const account = await this.prisma.ledgerAccount.findUnique({
            where: { code: accountCode },
        });
        if (!account) throw new BadRequestException(`Account not found: ${accountCode}`);
        return Number(account.balance);
    }

    async getTransactionEntries(transactionId: string) {
        return this.prisma.ledgerEntry.findMany({
            where: { transactionId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getAllBalances() {
        return this.prisma.ledgerAccount.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
            select: { code: true, name: true, type: true, currency: true, balance: true },
        });
    }

    async reconcile(): Promise<{ balanced: boolean; issues: string[] }> {
        const issues: string[] = [];

        const debitAgg = await this.prisma.ledgerEntry.aggregate({
            _sum: { amount: true },
            where: { entryType: 'DEBIT' },
        });
        const creditAgg = await this.prisma.ledgerEntry.aggregate({
            _sum: { amount: true },
            where: { entryType: 'CREDIT' },
        });
        const totalDebits = Number(debitAgg._sum.amount || 0);
        const totalCredits = Number(creditAgg._sum.amount || 0);

        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            issues.push(`CRITICAL: Global imbalance — debits=${totalDebits}, credits=${totalCredits}`);
        }

        const accounts = await this.prisma.ledgerAccount.findMany({ where: { isActive: true } });

        for (const account of accounts) {
            const debits = await this.prisma.ledgerEntry.aggregate({
                _sum: { amount: true },
                where: { accountCode: account.code, entryType: 'DEBIT' },
            });
            const credits = await this.prisma.ledgerEntry.aggregate({
                _sum: { amount: true },
                where: { accountCode: account.code, entryType: 'CREDIT' },
            });

            const debitTotal = Number(debits._sum.amount || 0);
            const creditTotal = Number(credits._sum.amount || 0);

            let derivedBalance: number;
            if (account.type === 'ASSET' || account.type === 'EXPENSE') {
                derivedBalance = debitTotal - creditTotal;
            } else {
                derivedBalance = creditTotal - debitTotal;
            }

            const storedBalance = Number(account.balance);
            if (Math.abs(storedBalance - derivedBalance) > 0.01) {
                issues.push(`Account ${account.code}: stored=${storedBalance}, derived=${derivedBalance}`);
            }
        }

        return { balanced: issues.length === 0, issues };
    }
}