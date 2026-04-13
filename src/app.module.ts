import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { QuoteModule } from './quotes/quote.module';

@Module({
  imports: [PrismaModule, AuthModule, LedgerModule, QuoteModule],
})
export class AppModule { }