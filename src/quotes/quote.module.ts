import { Module } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { FxRateService } from './fx-rate.service';

@Module({
    providers: [QuoteService, FxRateService],
    controllers: [QuoteController],
    exports: [QuoteService],
})
export class QuoteModule { }