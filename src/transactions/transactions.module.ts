import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { QuoteModule } from '../quotes/quote.module';
import { CryptoModule } from '../crypto/crypto.module';
import { PayoutModule } from '../payout/payout.module';
import { RecipientsModule } from '../recipients/recipients.module';

@Module({
    imports: [LedgerModule, QuoteModule, CryptoModule, PayoutModule, RecipientsModule],
    providers: [TransactionsService],
    controllers: [TransactionsController],
})
export class TransactionsModule { }