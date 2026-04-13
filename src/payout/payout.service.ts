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
     * In production: calls B2C2 or Cumberland API to execute USDC→GBP trade.
     * For MVP: simulates with a realistic OTC rate and small fee.
     * 
     * The OTC rate will be slightly worse than mid-market (their spread).
     */
    async sellUSDCForGBP(
        usdcAmount: number,
        targetGBPRate: number,  // the rate we quoted the user
    ): Promise<{
        gbpAmount: number;
        otcReference: string;
        otcFee: number;
    }> {
        this.logger.log(`Selling ${usdcAmount} USDC for GBP...`);

        // Simulate OTC processing (1-3 seconds)
        await this.delay(1000 + Math.random() * 2000);

        // OTC partner takes a tiny spread (~0.02-0.05%)
        // USDC is pegged 1:1 to USD, so we convert using the GBP rate
        const otcSpread = 0.0003; // 0.03%
        const effectiveRate = targetGBPRate * (1 - otcSpread);
        const grossGBP = usdcAmount * effectiveRate;

        // OTC flat fee (~£0.30)
        const otcFee = 0.30;
        const gbpAmount = parseFloat((grossGBP - otcFee).toFixed(2));

        const result = {
            gbpAmount,
            otcReference: `otc_sim_${randomUUID().substring(0, 8)}`,
            otcFee,
        };

        this.logger.log(`USDC→GBP complete: £${gbpAmount} (OTC fee: £${otcFee})`);
        return result;
    }

    /**
     * Send GBP to recipient via Faster Payments (FPS).
     * 
     * In production: calls ClearBank or Modulr API.
     * UK Faster Payments typically settle within seconds.
     * For MVP: simulates with a realistic delay.
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

        // ClearBank charges ~£0.20-0.50 per FPS payment
        const payoutFee = 0.25;

        const result = {
            paymentId: `fps_sim_${randomUUID().substring(0, 8)}`,
            payoutFee,
            status: 'SETTLED',  // FPS is usually instant
        };

        this.logger.log(`FPS payment sent: ${result.paymentId}`);
        return result;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}