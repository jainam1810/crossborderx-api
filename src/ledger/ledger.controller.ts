import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
    constructor(private ledgerService: LedgerService) { }

    @Get('balances')
    async getAllBalances() {
        return this.ledgerService.getAllBalances();
    }

    @Get('balance/:code')
    async getBalance(@Param('code') code: string) {
        const balance = await this.ledgerService.getBalance(code);
        return { accountCode: code, balance };
    }

    @Get('reconcile')
    async reconcile() {
        return this.ledgerService.reconcile();
    }

    @Get('transaction/:id')
    async getTransactionEntries(@Param('id') id: string) {
        return this.ledgerService.getTransactionEntries(id);
    }
}