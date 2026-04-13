import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Payout Service
 * 
 * Handles two things:
 * 1. Selling USDC for GBP via OTC partner (B2C2/Cumberland in production)
 * 2. Sending GBP to recipient via Faster Payments (ClearBank in production)
 * 
 * FOR MVP: Simulated with realistic delays, fees, and reference IDs.
 * When going live, replace with real API calls — the interface stays the same.
 */

@Injectable()
export class PayoutService {
    private readonly logger = new Logger('PayoutService');

    /**
   * Sell USDC for GBP via OTC partner.
   * 
   * REAL COST: ~5 basis points (0.05%) spread.
   * B2C2/Cumberland don't charge flat fees — cost is in the spread.
   * On $1,000 that's about $0.50
   */
    async sellUSDCForGBP(
        usdcAmount: number,
        targetGBPRate: number,
    ): Promise<{
        gbpAmount: number;
        otcReference: string;
        otcFee: number;
    }> {
        this.logger.log(`Selling ${usdcAmount} USDC for GBP...`);

        // Simulate OTC processing (1-3 seconds)
        await this.delay(1000 + Math.random() * 2000);

        // Real OTC spread: ~5 basis points (0.05%)
        const otcSpread = 0.0005;
        const effectiveRate = targetGBPRate * (1 - otcSpread);
        const gbpAmount = parseFloat((usdcAmount * effectiveRate).toFixed(2));

        // B2C2 doesn't charge a flat fee — it's all in the spread
        const otcFee = 0;

        const result = {
            gbpAmount,
            otcReference: `b2c2_${randomUUID().substring(0, 8)}`,
            otcFee,
        };

        this.logger.log(`USDC→GBP complete: £${gbpAmount} (OTC spread: ${otcSpread * 100}%)`);
        return result;
    }

    /**
   * Send GBP to recipient via Faster Payments.
   * 
   * REAL COST: ~£0.25 per FPS payment via ClearBank
   * (plus monthly platform fee amortized across transactions)
   */
    async sendFasterPayment(params: {
        sortCode: string;
        accountNumber: string;
        amount: number;
        recipientName: string;
        reference: string;
    }): Promise<{
        paymentId: string;
        payoutFee: number;
        status: string;
    }> {
        this.logger.log(
            `Sending £${params.amount} to ${params.recipientName} ` +
            `(${params.sortCode} / ${params.accountNumber})...`
        );

        // Simulate FPS processing (1-3 seconds)
        await this.delay(1000 + Math.random() * 2000);

        // Real ClearBank FPS fee: ~£0.25 per payment
        const payoutFee = 0.25;

        const result = {
            paymentId: `fps_${randomUUID().substring(0, 8)}`,
            payoutFee,
            status: 'SETTLED',
        };

        this.logger.log(`FPS payment sent: ${result.paymentId} (fee: £${payoutFee})`);
        return result;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}