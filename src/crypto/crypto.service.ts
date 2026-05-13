import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
    getOrCreateAssociatedTokenAccount,
    transfer,
} from '@solana/spl-token';
import { SolanaConfigService } from '../solana/solana-config.service';

/**
 * Crypto Service
 *
 * Handles two things:
 * 1. Buying USDC with USD (still SIMULATED — Circle Mint requires a business account)
 * 2. Sending USDC from US wallet to UK wallet — REAL ON-CHAIN on devnet
 *
 * Flip SOLANA_USE_SIMULATION=true in .env to fall back to all-simulated mode
 * (useful for offline dev or if devnet is having an outage).
 */
@Injectable()
export class CryptoService {
    private readonly logger = new Logger('CryptoService');

    constructor(private readonly solana: SolanaConfigService) { }

    private get useSimulation(): boolean {
        return process.env.SOLANA_USE_SIMULATION === 'true';
    }

    /**
     * Purchase USDC with USD.
     * STILL SIMULATED. Circle Mint integration requires a business account.
     * REAL COST: Circle Mint is FREE at normal volumes (<$2M/day). 1 USD = 1 USDC.
     */
    async purchaseUSDC(amountUSD: number): Promise<{
        usdcAmount: number;
        providerReference: string;
        fee: number;
    }> {
        this.logger.log(`Purchasing USDC for $${amountUSD}... (simulated)`);
        await this.delay(1000 + Math.random() * 1000);
        const usdcAmount = parseFloat(amountUSD.toFixed(6));
        const result = {
            usdcAmount,
            providerReference: `circle_${randomUUID().substring(0, 8)}`,
            fee: 0,
        };
        this.logger.log(`USDC purchased: ${usdcAmount} USDC (fee: $${result.fee})`);
        return result;
    }

    /**
     * Send USDC from US hot wallet to UK hot wallet — REAL on-chain transfer.
     *
     * Steps:
     *   1. Ensure both wallets have token accounts for our USDC mint.
     *      (Creates UK's token account on first run, paid by US wallet.)
     *   2. Build and broadcast a transfer instruction.
     *   3. Wait for the network to confirm.
     *   4. Return the real signature.
     */
    async sendUSDCOnChain(amount: number): Promise<{
        txSignature: string;
        gasFee: number;
        network: string;
    }> {
        if (this.useSimulation) {
            return this.sendUSDCOnChainSimulated(amount);
        }

        const { connection, usdcMint, usWallet, ukWallet, network } = this.solana;
        this.logger.log(
            `Sending ${amount} USDC on Solana ${network} (US → UK)...`,
        );

        try {
            // 1. Get (or create) the source token account on the US wallet
            const sourceAta = await getOrCreateAssociatedTokenAccount(
                connection,
                usWallet,        // payer
                usdcMint,
                usWallet.publicKey,
            );

            // 2. Get (or create) the destination token account on the UK wallet.
            //    First time: this creates the account and the US wallet pays the
            //    rent (~0.002 SOL). Subsequent times: just returns the existing one.
            const destAta = await getOrCreateAssociatedTokenAccount(
                connection,
                usWallet,        // US wallet pays for UK's account creation
                usdcMint,
                ukWallet.publicKey,
            );

            // 3. Convert the human amount to base units (USDC has 6 decimals).
            //    Math.round to avoid floating-point dust (995.92 → 995920000 exact).
            const amountBaseUnits = Math.round(amount * 1_000_000);

            // 4. Execute the transfer
            const txSignature = await transfer(
                connection,
                usWallet,           // payer (also signs the transfer)
                sourceAta.address,
                destAta.address,
                usWallet,           // owner of source account (same key)
                amountBaseUnits,
            );

            this.logger.log(
                `✓ USDC transferred on-chain. Sig: ${txSignature.substring(0, 20)}...`,
            );
            this.logger.log(`  Explorer: ${this.solana.explorerTxUrl(txSignature)}`);

            // Solana's base fee is 5,000 lamports = 0.000005 SOL.
            // We're approximating since reading the exact fee requires another RPC call.
            const gasFee = 0.000005;

            return {
                txSignature,
                gasFee,
                network: `solana-${network}`,
            };
        } catch (err: any) {
            this.logger.error(
                `Failed to send USDC on-chain: ${err.message ?? err}`,
            );
            // Re-throw so the orchestrator's failure handler picks it up
            // and marks the transaction as FAILED.
            throw new Error(`On-chain USDC transfer failed: ${err.message ?? err}`);
        }
    }

    /**
     * Simulation fallback for the on-chain transfer.
     * Used when SOLANA_USE_SIMULATION=true (e.g. offline dev or devnet outage).
     */
    private async sendUSDCOnChainSimulated(amount: number): Promise<{
        txSignature: string;
        gasFee: number;
        network: string;
    }> {
        this.logger.log(
            `Sending ${amount} USDC (SIMULATED, no on-chain call)...`,
        );
        await this.delay(400);

        const chars =
            '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let txSignature = '';
        for (let i = 0; i < 88; i++) {
            txSignature += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return {
            txSignature,
            gasFee: 0.000005,
            network: 'solana-simulated',
        };
    }

    /**
     * Get the on-chain USDC balance of one of our hot wallets.
     */
    async getWalletBalance(wallet: 'US' | 'UK'): Promise<number> {
        if (this.useSimulation) {
            return wallet === 'US' ? 50000.0 : 12000.0;
        }

        const { connection, usdcMint, usWallet, ukWallet } = this.solana;
        const owner = wallet === 'US' ? usWallet : ukWallet;

        try {
            const ata = await getOrCreateAssociatedTokenAccount(
                connection,
                owner,       // payer (only used if account doesn't exist yet)
                usdcMint,
                owner.publicKey,
            );
            const info = await connection.getTokenAccountBalance(ata.address);
            return parseFloat(info.value.uiAmountString ?? '0');
        } catch (err: any) {
            this.logger.warn(
                `Could not read ${wallet} wallet USDC balance: ${err.message}`,
            );
            return 0;
        }
    }

    /**
    * Health check.
    * In simulation mode: returns instantly with mode='simulated'.
    * In production: will ping Circle's status endpoint and return real latency.
    */
    async healthCheck(): Promise<{ ok: boolean; mode: 'simulated' | 'live'; provider: string }> {
        return { ok: true, mode: 'simulated', provider: 'circle' };
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}