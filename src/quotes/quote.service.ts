import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FxRateService } from './fx-rate.service';

@Injectable()
export class QuoteService {
    private readonly DEFAULT_SPREAD_PCT = 0.0039;
    private readonly DEFAULT_FLAT_FEE = 0.99;
    private readonly QUOTE_EXPIRY_SECONDS = 60;

    constructor(private prisma: PrismaService, private fxRateService: FxRateService) { }

    async createQuote(userId: string, dto: { sendAmount: number; sendCurrency: string; receiveCurrency: string }) {
        if (dto.sendAmount <= 0) throw new BadRequestException('Send amount must be positive');
        if (dto.sendAmount < 10) throw new BadRequestException('Minimum send amount is $10');
        if (dto.sendAmount > 50000) throw new BadRequestException('Maximum send amount is $50,000');

        const midRate = await this.fxRateService.getMidMarketRate(dto.sendCurrency, dto.receiveCurrency);
        const quote = this.fxRateService.calculateQuote(dto.sendAmount, midRate, this.DEFAULT_SPREAD_PCT, this.DEFAULT_FLAT_FEE);
        const expiresAt = new Date(Date.now() + this.QUOTE_EXPIRY_SECONDS * 1000);

        const saved = await this.prisma.quote.create({
            data: {
                userId,
                sendCurrency: dto.sendCurrency,
                receiveCurrency: dto.receiveCurrency,
                sendAmount: quote.sendAmount,
                receiveAmount: quote.receiveAmount,
                midMarketRate: quote.midMarketRate,
                appliedRate: quote.appliedRate,
                spreadPct: quote.spreadPct,
                flatFee: this.DEFAULT_FLAT_FEE,
                totalFee: quote.totalFee,
                expiresAt,
            },
        });

        return {
            quoteId: saved.id,
            sendAmount: Number(saved.sendAmount),
            sendCurrency: saved.sendCurrency,
            receiveAmount: Number(saved.receiveAmount),
            receiveCurrency: saved.receiveCurrency,
            midMarketRate: Number(saved.midMarketRate),
            appliedRate: Number(saved.appliedRate),
            spreadPct: Number(saved.spreadPct),
            flatFee: Number(saved.flatFee),
            totalFee: Number(saved.totalFee),
            expiresAt: saved.expiresAt,
        };
    }

    async getQuote(quoteId: string) {
        const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
        if (!quote) throw new NotFoundException('Quote not found');

        return {
            quoteId: quote.id,
            sendAmount: Number(quote.sendAmount),
            sendCurrency: quote.sendCurrency,
            receiveAmount: Number(quote.receiveAmount),
            receiveCurrency: quote.receiveCurrency,
            midMarketRate: Number(quote.midMarketRate),
            appliedRate: Number(quote.appliedRate),
            spreadPct: Number(quote.spreadPct),
            flatFee: Number(quote.flatFee),
            totalFee: Number(quote.totalFee),
            expiresAt: quote.expiresAt,
            isExpired: new Date() > quote.expiresAt,
            isUsed: quote.isUsed,
        };
    }

    async findAndValidate(quoteId: string) {
        const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
        if (!quote) throw new NotFoundException('Quote not found');
        if (quote.isUsed) throw new BadRequestException('Quote has already been used');
        if (new Date() > quote.expiresAt) throw new BadRequestException('Quote has expired. Please request a new quote.');
        return quote;
    }

    async markUsed(quoteId: string) {
        await this.prisma.quote.update({ where: { id: quoteId }, data: { isUsed: true } });
    }
}