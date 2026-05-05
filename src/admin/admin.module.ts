import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { LedgerModule } from '../ledger/ledger.module';
import { CryptoModule } from '../crypto/crypto.module';
import { PayoutModule } from '../payout/payout.module';

@Module({
    imports: [LedgerModule, CryptoModule, PayoutModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }