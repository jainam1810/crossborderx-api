import { Global, Module } from '@nestjs/common';
import { SolanaConfigService } from './solana-config.service';

@Global()
@Module({
    providers: [SolanaConfigService],
    exports: [SolanaConfigService],
})
export class SolanaModule { }