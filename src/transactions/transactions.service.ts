import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { QuoteService } from '../quotes/quote.service';
import { CryptoService } from '../crypto/crypto.service';
import { PayoutService } from '../payout/payout.service';
import { RecipientsService } from '../recipients/recipients.service';
import { assertTransition } from './transaction-state-machine';

@Injectable()
export class TransactionsService {
    private readonly logger = new Logger('TransactionsService');

    constructor(
        private prisma: PrismaService,
        private ledger: LedgerService,
        private quoteService: QuoteService,
        private cryptoService: CryptoService,
        private payoutService: PayoutService,
        private recipientsService: RecipientsService,
    ) { }

    /**
     * CREATE A TRANSACTION
     * 
     * This is called when the user confirms a transfer.
     * It validates everything, creates the transaction record,
     * and then kicks off the processing pipeline.
     * 
     * For MVP: we process synchronously (one step after another).
     * In production: you'd use BullMQ to process async with retries.
     */
    async createTransaction(userId: string, dto: {
        quoteId: string;
        recipientId: string;
    }) {
        // 1. Validate the quote (exists, not expired, not used)
        const quote = await this.quoteService.findAndValidate(dto.quoteId);

        // 2. Validate the recipient belongs to this user
        const recipient = await this.recipientsService.findOne(userId, dto.recipientId);

        // 3. Check quote belongs to this user
        if (quote.userId !== userId) {
            throw new BadRequestException('Quote does not belong to this user');
        }

        // 4. Create the transaction record
        const tx = await this.prisma.transaction.create({
            data: {
                userId,
                quoteId: quote.id,
                recipientId: recipient.id,
                status: 'INITIATED',
                sendAmount: quote.sendAmount,
                sendCurrency: quote.sendCurrency,
                receiveAmount: quote.receiveAmount,
                receiveCurrency: quote.receiveCurrency,
                feeAmount: quote.totalFee,
                appliedRate: quote.appliedRate,
            },
        });

        // 5. Mark quote as used
        await this.quoteService.markUsed(quote.id);

        // 6. Log the initial status
        await this.logStatusChange(tx.id, null, 'INITIATED', 'system');

        this.logger.log(`Transaction ${tx.id} created. Starting processing...`);

        // 7. Process the transaction (all steps)
        // In production, this would be queued via BullMQ
        // For MVP, we process synchronously but don't await it
        // so the API responds immediately
        this.processTransaction(tx.id).catch(err => {
            this.logger.error(`Transaction ${tx.id} processing failed: ${err.message}`);
        });

        return {
            transactionId: tx.id,
            status: 'INITIATED',
            message: 'Transaction created. Processing has started.',
        };
    }

    /**
     * PROCESS A TRANSACTION
     * 
     * This is the heart of the system. It drives the transaction
     * through all 7 steps, creating ledger entries at each step.
     * 
     * Steps:
     * 1. INITIATED → FIAT_RECEIVED (simulate payment collection)
     * 2. FIAT_RECEIVED → STABLECOIN_ACQUIRED (buy USDC)
     * 3. STABLECOIN_ACQUIRED → SETTLED_ON_CHAIN (send USDC on Solana)
     * 4. SETTLED_ON_CHAIN → FIAT_CONVERTED (sell USDC for GBP)
     * 5. FIAT_CONVERTED → PAYOUT_INITIATED (send GBP via FPS)
     * 6. PAYOUT_INITIATED → COMPLETED (confirm delivery)
     */
    async processTransaction(txId: string) {
        let tx = await this.findTransaction(txId);

        try {
            // ═══════════════════════════════════════════
            // STEP 1: Simulate fiat collection (Stripe)
            // In production: Stripe webhook triggers this
            // ═══════════════════════════════════════════
            this.logger.log(`[${txId.substring(0, 8)}] Step 1: Collecting USD...`);
            await this.delay(500); // simulate payment processing

            await this.updateStatus(txId, 'FIAT_RECEIVED');

            // LEDGER: USD arrives in Stripe, you owe the user a transfer
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'ASSET:USD:STRIPE',
                    entryType: 'DEBIT',
                    amount: Number(tx.sendAmount),
                    currency: 'USD',
                    description: `USD received from user for tx ${txId.substring(0, 8)}`,
                },
                {
                    accountCode: 'LIABILITY:USD:USER_FUNDS',
                    entryType: 'CREDIT',
                    amount: Number(tx.sendAmount),
                    currency: 'USD',
                    description: `Liability: owe user transfer for tx ${txId.substring(0, 8)}`,
                },
            ]);

            // LEDGER: Collect your fees
            const feeAmount = Number(tx.feeAmount);
            const flatFee = 2.0;
            const spreadRevenue = feeAmount - flatFee;

            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'LIABILITY:USD:USER_FUNDS',
                    entryType: 'DEBIT',
                    amount: feeAmount,
                    currency: 'USD',
                    description: `Fees collected: $${flatFee} flat + $${spreadRevenue.toFixed(2)} spread`,
                },
                {
                    accountCode: 'REVENUE:FEES',
                    entryType: 'CREDIT',
                    amount: flatFee,
                    currency: 'USD',
                    description: 'Flat fee revenue',
                },
                {
                    accountCode: 'REVENUE:SPREAD',
                    entryType: 'CREDIT',
                    amount: spreadRevenue,
                    currency: 'USD',
                    description: 'FX spread revenue',
                },
            ]);

            // ═══════════════════════════════════════════
            // STEP 2: Buy USDC with the net USD amount
            // ═══════════════════════════════════════════
            tx = await this.findTransaction(txId); // refresh
            const netAmount = Number(tx.sendAmount) - feeAmount;
            this.logger.log(`[${txId.substring(0, 8)}] Step 2: Buying USDC with $${netAmount}...`);

            const usdc = await this.cryptoService.purchaseUSDC(netAmount);

            await this.updateStatus(txId, 'STABLECOIN_ACQUIRED', {
                usdcAmount: usdc.usdcAmount,
            });

            // LEDGER: USD leaves Stripe, USDC enters US wallet
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'ASSET:USDC:HOT_WALLET_US',
                    entryType: 'DEBIT',
                    amount: usdc.usdcAmount,
                    currency: 'USDC',
                    description: `USDC purchased via ${usdc.providerReference}`,
                },
                {
                    accountCode: 'EXPENSE:ONRAMP_FEES',
                    entryType: 'DEBIT',
                    amount: usdc.fee,
                    currency: 'USD',
                    description: 'USDC purchase fee',
                },
                {
                    accountCode: 'ASSET:USD:STRIPE',
                    entryType: 'CREDIT',
                    amount: netAmount,
                    currency: 'USD',
                    description: 'USD sent to purchase USDC',
                },
            ]);

            // ═══════════════════════════════════════════
            // STEP 3: Send USDC on Solana (US → UK wallet)
            // ═══════════════════════════════════════════
            this.logger.log(`[${txId.substring(0, 8)}] Step 3: Sending USDC on Solana...`);

            const solTx = await this.cryptoService.sendUSDCOnChain(usdc.usdcAmount);

            await this.updateStatus(txId, 'SETTLED_ON_CHAIN', {
                blockchainTxHash: solTx.txSignature,
                blockchainFee: solTx.gasFee,
                settledAt: new Date(),
            });

            // LEDGER: USDC moves from US wallet to UK wallet
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'ASSET:USDC:HOT_WALLET_UK',
                    entryType: 'DEBIT',
                    amount: usdc.usdcAmount,
                    currency: 'USDC',
                    description: `USDC received in UK wallet. Tx: ${solTx.txSignature.substring(0, 20)}...`,
                },
                {
                    accountCode: 'ASSET:USDC:HOT_WALLET_US',
                    entryType: 'CREDIT',
                    amount: usdc.usdcAmount,
                    currency: 'USDC',
                    description: 'USDC sent from US wallet',
                },
            ]);

            // LEDGER: Gas fee
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'EXPENSE:GAS_FEES',
                    entryType: 'DEBIT',
                    amount: solTx.gasFee,
                    currency: 'USDC',
                    description: 'Solana gas fee',
                },
                {
                    accountCode: 'ASSET:USDC:HOT_WALLET_US',
                    entryType: 'CREDIT',
                    amount: solTx.gasFee,
                    currency: 'USDC',
                    description: 'Gas fee paid from US wallet',
                },
            ]);

            // ═══════════════════════════════════════════
            // STEP 4: Sell USDC for GBP via OTC
            // Use the QUOTE's rate — not a new calculation
            // ═══════════════════════════════════════════
            this.logger.log(`[${txId.substring(0, 8)}] Step 4: Converting USDC to GBP...`);

            // Use the exact receive amount from the quote
            // This is what we promised the user — deliver exactly this
            const promisedGBP = Number(tx.receiveAmount);

            await this.updateStatus(txId, 'FIAT_CONVERTED', {
                otcProvider: 'simulated_otc',
                otcReference: `b2c2_${txId.substring(0, 8)}`,
                gbpReceived: promisedGBP,
                convertedAt: new Date(),
            });

            // LEDGER: Remove USDC from UK wallet
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'EXPENSE:OFFRAMP_FEES',
                    entryType: 'DEBIT',
                    amount: usdc.usdcAmount,
                    currency: 'USDC',
                    description: 'USDC sent to OTC for GBP conversion',
                },
                {
                    accountCode: 'ASSET:USDC:HOT_WALLET_UK',
                    entryType: 'CREDIT',
                    amount: usdc.usdcAmount,
                    currency: 'USDC',
                    description: 'USDC sold for GBP via OTC',
                },
            ]);

            // LEDGER: GBP arrives in ClearBank
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'ASSET:GBP:CLEARBANK',
                    entryType: 'DEBIT',
                    amount: promisedGBP,
                    currency: 'GBP',
                    description: 'GBP received from OTC conversion',
                },
                {
                    accountCode: 'REVENUE:SPREAD',
                    entryType: 'CREDIT',
                    amount: promisedGBP,
                    currency: 'GBP',
                    description: 'GBP received from OTC conversion',
                },
            ]);

            // ═══════════════════════════════════════════
            // STEP 5: Send GBP via Faster Payments
            // Send EXACTLY what we quoted — no more deductions
            // ═══════════════════════════════════════════
            this.logger.log(`[${txId.substring(0, 8)}] Step 5: Sending £${promisedGBP} via Faster Payments...`);

            const recipient = await this.prisma.recipient.findUnique({
                where: { id: tx.recipientId },
            });
            if (!recipient) throw new Error('Recipient not found');

            const fps = await this.payoutService.sendFasterPayment({
                sortCode: recipient.sortCode,
                accountNumber: recipient.accountNumber,
                amount: promisedGBP,
                recipientName: recipient.fullName,
                reference: `CBX-${txId.substring(0, 8).toUpperCase()}`,
            });

            await this.updateStatus(txId, 'PAYOUT_INITIATED', {
                payoutProvider: 'simulated_clearbank',
                payoutReference: fps.paymentId,
                payoutInitiatedAt: new Date(),
            });

            // LEDGER: GBP paid out to recipient (exact quoted amount)
            await this.ledger.recordJournal(txId, [
                {
                    accountCode: 'EXPENSE:OFFRAMP_FEES',
                    entryType: 'DEBIT',
                    amount: promisedGBP,
                    currency: 'GBP',
                    description: `GBP delivered to ${recipient.fullName}`,
                },
                {
                    accountCode: 'ASSET:GBP:CLEARBANK',
                    entryType: 'CREDIT',
                    amount: promisedGBP,
                    currency: 'GBP',
                    description: `FPS payout via ${fps.paymentId}`,
                },
            ]);

            // ═══════════════════════════════════════════
            // STEP 6: Mark as completed
            // In production: ClearBank webhook triggers this
            // ═══════════════════════════════════════════
            this.logger.log(`[${txId.substring(0, 8)}] Step 6: Complete!`);

            await this.updateStatus(txId, 'COMPLETED', {
                completedAt: new Date(),
            });

            this.logger.log(
                `✅ Transaction ${txId.substring(0, 8)} completed! ` +
                `$${tx.sendAmount} → £${promisedGBP} to ${recipient.fullName}`
            );

        } catch (error: any) {
            this.logger.error(`❌ Transaction ${txId.substring(0, 8)} failed: ${error.message}`);

            // Update transaction to FAILED
            try {
                const currentTx = await this.findTransaction(txId);
                if (currentTx.status !== 'FAILED' && currentTx.status !== 'COMPLETED') {
                    await this.prisma.transaction.update({
                        where: { id: txId },
                        data: {
                            status: 'FAILED',
                            failureReason: error.message,
                            failureStep: currentTx.status,
                            retryCount: { increment: 1 },
                        },
                    });
                    await this.logStatusChange(txId, currentTx.status, 'FAILED', 'system', {
                        error: error.message,
                    });
                }
            } catch (updateErr: any) {
                this.logger.error(`Failed to update tx status: ${updateErr.message}`);
            }

            throw error;
        }
    }

    /**
     * Get a single transaction with its full status timeline.
     */
    async getTransaction(userId: string, txId: string) {
        const tx = await this.prisma.transaction.findFirst({
            where: { id: txId, userId },
            include: {
                recipient: {
                    select: { fullName: true, sortCode: true, accountNumber: true },
                },
                statusLogs: {
                    orderBy: { createdAt: 'asc' },
                    select: { fromStatus: true, toStatus: true, createdAt: true },
                },
            },
        });

        if (!tx) throw new NotFoundException('Transaction not found');

        return {
            id: tx.id,
            status: tx.status,
            sendAmount: Number(tx.sendAmount),
            sendCurrency: tx.sendCurrency,
            receiveAmount: Number(tx.receiveAmount),
            receiveCurrency: tx.receiveCurrency,
            feeAmount: Number(tx.feeAmount),
            appliedRate: Number(tx.appliedRate),
            blockchainTxHash: tx.blockchainTxHash,
            recipient: tx.recipient,
            statusTimeline: tx.statusLogs.map(log => ({
                from: log.fromStatus,
                to: log.toStatus,
                at: log.createdAt,
            })),
            createdAt: tx.createdAt,
            completedAt: tx.completedAt,
        };
    }

    /**
     * List all transactions for a user.
     */
    async listTransactions(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    status: true,
                    sendAmount: true,
                    sendCurrency: true,
                    receiveAmount: true,
                    receiveCurrency: true,
                    feeAmount: true,
                    createdAt: true,
                    completedAt: true,
                    recipient: {
                        select: { fullName: true },
                    },
                },
            }),
            this.prisma.transaction.count({ where: { userId } }),
        ]);

        return {
            data: data.map(tx => ({
                ...tx,
                sendAmount: Number(tx.sendAmount),
                receiveAmount: Number(tx.receiveAmount),
                feeAmount: Number(tx.feeAmount),
            })),
            total,
            page,
            limit,
        };
    }

    // ─── Helper methods ───

    private async findTransaction(txId: string) {
        const tx = await this.prisma.transaction.findUnique({ where: { id: txId } });
        if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);
        return tx;
    }

    private async updateStatus(txId: string, newStatus: string, extra?: Record<string, any>) {
        const tx = await this.findTransaction(txId);
        assertTransition(tx.status, newStatus);

        await this.prisma.transaction.update({
            where: { id: txId },
            data: { status: newStatus, ...extra, updatedAt: new Date() },
        });

        await this.logStatusChange(txId, tx.status, newStatus, 'system');
    }

    private async logStatusChange(
        txId: string,
        from: string | null,
        to: string,
        triggeredBy: string,
        metadata?: Record<string, any>,
    ) {
        await this.prisma.transactionStatusLog.create({
            data: {
                transactionId: txId,
                fromStatus: from,
                toStatus: to,
                triggeredBy,
                metadata: metadata || {},
            },
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}