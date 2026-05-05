import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListTransactionsDto } from './dto/list-transactions.dto';
import { Prisma } from '@prisma/client';
import { AdminStatsDto } from './dto/stats.dto';
import { LedgerService } from 'src/ledger/ledger.service';
import { CryptoService } from '../crypto/crypto.service';
import { PayoutService } from '../payout/payout.service';
import * as net from 'net';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ledger: LedgerService,
        private readonly crypto: CryptoService,
        private readonly payout: PayoutService,
    ) { }

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

    async getStats(filters: AdminStatsDto) {
        const days = Math.min(365, Math.max(1, parseInt(filters.days ?? '30', 10) || 30));
        const since = new Date();
        since.setUTCHours(0, 0, 0, 0);
        since.setUTCDate(since.getUTCDate() - (days - 1));

        // --- Pull revenue from the ledger (single currency: USD) ---
        // We deliberately do NOT read EXPENSE:* accounts here.
        // Per project doc decision #4, EXPENSE accounts double as cross-currency
        // bridges between USD/USDC/GBP journals, so their balances mix true costs
        // with bridge entries and don't represent platform expenses on their own.
        // The full ledger picture lives in the /admin/ledger endpoint instead.
        const accountCodes = ['REVENUE:FEES', 'REVENUE:SPREAD'];

        const accounts = await this.prisma.ledgerAccount.findMany({
            where: { code: { in: accountCodes } },
            select: { code: true, balance: true },
        });

        const balanceByCode: Record<string, number> = {};
        for (const a of accounts) {
            balanceByCode[a.code] = Number(a.balance);
        }

        const revenueFees = balanceByCode['REVENUE:FEES'] ?? 0;
        const revenueSpread = balanceByCode['REVENUE:SPREAD'] ?? 0;
        const totalRevenue = revenueFees + revenueSpread;

        // --- Transaction counts and volume ---
        const [
            totalTransactions,
            completedCount,
            failedCount,
            inFlightCount,
            completedAggregate,
        ] = await this.prisma.$transaction([
            this.prisma.transaction.count(),
            this.prisma.transaction.count({ where: { status: 'COMPLETED' } }),
            this.prisma.transaction.count({ where: { status: 'FAILED' } }),
            this.prisma.transaction.count({
                where: {
                    status: {
                        in: [
                            'INITIATED',
                            'FIAT_RECEIVED',
                            'STABLECOIN_ACQUIRED',
                            'SETTLED_ON_CHAIN',
                            'FIAT_CONVERTED',
                            'PAYOUT_INITIATED',
                        ],
                    },
                },
            }),
            this.prisma.transaction.aggregate({
                where: { status: 'COMPLETED' },
                _sum: { sendAmount: true },
            }),
        ]);

        const totalVolumeUsd = Number(completedAggregate._sum.sendAmount ?? 0);

        // --- Operational cost: real per-transaction provider costs ---
        // From project documentation: ~$0.89 per transaction
        // (Circle Mint free, Solana gas $0.005, B2C2 OTC ~$0.50, ClearBank FPS ~£0.25 / $0.32).
        // Multiplied by completed transaction count for total operational spend.
        const COST_PER_COMPLETED_TX_USD = 0.89;
        const totalOperationalCost = completedCount * COST_PER_COMPLETED_TX_USD;
        const profit = totalRevenue - totalOperationalCost;

        // --- Daily breakdown for the chart ---
        const recentCompleted = await this.prisma.transaction.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: { gte: since },
            },
            select: { createdAt: true, sendAmount: true },
        });

        const dailyMap: Record<string, { volume: number; count: number }> = {};
        for (let i = 0; i < days; i++) {
            const d = new Date(since);
            d.setUTCDate(since.getUTCDate() + i);
            const key = d.toISOString().slice(0, 10);
            dailyMap[key] = { volume: 0, count: 0 };
        }

        for (const tx of recentCompleted) {
            const key = tx.createdAt.toISOString().slice(0, 10);
            if (dailyMap[key]) {
                dailyMap[key].volume += Number(tx.sendAmount);
                dailyMap[key].count += 1;
            }
        }

        const dailyBreakdown = Object.entries(dailyMap)
            .map(([date, v]) => ({ date, volume: v.volume, count: v.count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            revenue: {
                fees: revenueFees,
                spread: revenueSpread,
                total: totalRevenue,
            },
            costs: {
                perTransactionUsd: COST_PER_COMPLETED_TX_USD,
                totalOperationalUsd: totalOperationalCost,
            },
            profit,
            transactions: {
                total: totalTransactions,
                completed: completedCount,
                failed: failedCount,
                inFlight: inFlightCount,
                volumeUsd: totalVolumeUsd,
            },
            dailyBreakdown,
            window: {
                days,
                from: since.toISOString(),
                to: new Date().toISOString(),
            },
        };
    }
    async getLedgerHealth() {
        // Pull all accounts and the reconciliation result in parallel
        const [accounts, reconciliation, recentEntriesCount] = await Promise.all([
            this.prisma.ledgerAccount.findMany({
                orderBy: [{ type: 'asc' }, { code: 'asc' }],
                select: {
                    code: true,
                    name: true,
                    type: true,
                    currency: true,
                    balance: true,
                },
            }),
            this.ledger.reconcile(),
            this.prisma.ledgerEntry.count({
                where: {
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        // Group accounts by type for UI rendering
        const grouped: Record<string, Array<{
            code: string;
            name: string;
            currency: string;
            balance: number;
        }>> = {
            ASSET: [],
            LIABILITY: [],
            REVENUE: [],
            EXPENSE: [],
        };

        for (const a of accounts) {
            const row = {
                code: a.code,
                name: a.name,
                currency: a.currency,
                balance: Number(a.balance),
            };
            if (grouped[a.type]) {
                grouped[a.type].push(row);
            }
        }

        return {
            reconciliation,
            accounts: grouped,
            accountsTotal: accounts.length,
            entriesLast24h: recentEntriesCount,
        };
    }
    async getSystemHealth() {
        const [postgres, redis, simulated, failedTxCount] = await Promise.all([
            this.checkPostgres(),
            this.checkRedis(),
            this.checkSimulatedServices(),
            this.countRecentFailures(),
        ]);

        const allUp =
            postgres.status === 'up' &&
            redis.status === 'up' &&
            simulated.status === 'up';

        return {
            status: allUp ? 'healthy' : 'degraded',
            checks: { postgres, redis, simulated },
            operations: {
                failedLast24h: failedTxCount,
            },
            timestamp: new Date().toISOString(),
        };
    }

    private async checkPostgres() {
        const start = Date.now();
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'up' as const, latencyMs: Date.now() - start };
        } catch (err: any) {
            return {
                status: 'down' as const,
                latencyMs: Date.now() - start,
                error: err?.message ?? 'Unknown error',
            };
        }
    }

    private checkRedis(): Promise<{
        status: 'up' | 'down';
        latencyMs: number;
        error?: string;
    }> {
        const host = process.env.REDIS_HOST ?? 'localhost';
        const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
        const timeoutMs = 1500;

        return new Promise((resolve) => {
            const start = Date.now();
            const socket = new net.Socket();
            let settled = false;

            const finish = (
                result: { status: 'up' | 'down'; latencyMs: number; error?: string },
            ) => {
                if (settled) return;
                settled = true;
                socket.destroy();
                resolve(result);
            };

            socket.setTimeout(timeoutMs);

            socket.on('connect', () => {
                socket.write('PING\r\n');
            });

            socket.on('data', (data) => {
                const reply = data.toString();
                if (reply.startsWith('+PONG')) {
                    finish({ status: 'up', latencyMs: Date.now() - start });
                } else {
                    finish({
                        status: 'down',
                        latencyMs: Date.now() - start,
                        error: `Unexpected reply: ${reply.trim()}`,
                    });
                }
            });

            socket.on('timeout', () => {
                finish({
                    status: 'down',
                    latencyMs: Date.now() - start,
                    error: 'Connection timeout',
                });
            });

            socket.on('error', (err) => {
                finish({
                    status: 'down',
                    latencyMs: Date.now() - start,
                    error: err.message,
                });
            });

            socket.connect(port, host);
        });
    }

    private async checkSimulatedServices() {
        const start = Date.now();
        try {
            const [crypto, payout] = await Promise.all([
                this.crypto.healthCheck(),
                this.payout.healthCheck(),
            ]);

            const allOk = crypto.ok && payout.ok;
            return {
                status: allOk ? ('up' as const) : ('down' as const),
                latencyMs: Date.now() - start,
                details: { crypto, payout },
            };
        } catch (err: any) {
            return {
                status: 'down' as const,
                latencyMs: Date.now() - start,
                error: err?.message ?? 'Unknown error',
            };
        }
    }

    private async countRecentFailures() {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return this.prisma.transaction.count({
            where: {
                status: 'FAILED',
                createdAt: { gte: since },
            },
        });
    }
}