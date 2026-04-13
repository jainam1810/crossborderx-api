import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FxRateService {
    private readonly logger = new Logger('FxRateService');
    private rateCache: Map<string, { rate: number; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 15_000;

    async getMidMarketRate(from: string, to: string): Promise<number> {
        const cacheKey = `${from}:${to}`;
        const cached = this.rateCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
            return cached.rate;
        }

        const rate = await this.getSimulatedRate(from, to);
        this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });
        this.logger.log(`FX rate ${from}→${to}: ${rate}`);
        return rate;
    }

    calculateQuote(
        sendAmount: number,
        midRate: number,
        spreadPct: number,
        flatFee: number,
    ) {
        const appliedRate = midRate * (1 - spreadPct);
        const netSendAmount = sendAmount - flatFee;
        const receiveAmount = parseFloat((netSendAmount * appliedRate).toFixed(2));

        const spreadRevenue = parseFloat(
            (netSendAmount * midRate - netSendAmount * appliedRate).toFixed(2),
        );
        const totalFee = parseFloat((flatFee + spreadRevenue).toFixed(2));

        return {
            midMarketRate: midRate,
            appliedRate: parseFloat(appliedRate.toFixed(8)),
            spreadPct,
            flatFee,
            totalFee,
            sendAmount,
            receiveAmount,
        };
    }

    private async getSimulatedRate(from: string, to: string): Promise<number> {
        const baseRates: Record<string, number> = {
            'USD:GBP': 0.7920,
            'USD:EUR': 0.9210,
            'GBP:USD': 1.2626,
            'EUR:USD': 1.0858,
        };

        const key = `${from}:${to}`;
        const baseRate = baseRates[key];
        if (!baseRate) throw new Error(`Unsupported currency pair: ${from}→${to}`);

        const fluctuation = 1 + (Math.random() - 0.5) * 0.004;
        return parseFloat((baseRate * fluctuation).toFixed(8));
    }
}