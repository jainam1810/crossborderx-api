import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { QuoteModule } from './quotes/quote.module';
import { RecipientsModule } from './recipients/recipients.module';
import { CryptoModule } from './crypto/crypto.module';
import { PayoutModule } from './payout/payout.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AdminModule } from './admin/admin.module';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LedgerModule,
    QuoteModule,
    RecipientsModule,
    CryptoModule,
    SolanaModule,
    PayoutModule,
    TransactionsModule,
    AdminModule,
  ],
})
export class AppModule { }