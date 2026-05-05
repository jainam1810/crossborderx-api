import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminListTransactionsDto } from './dto/list-transactions.dto';
import { AdminStatsDto } from './dto/stats.dto';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('transactions')
    listTransactions(@Query() filters: AdminListTransactionsDto) {
        return this.adminService.listTransactions(filters);
    }
    @Get('stats')
    getStats(@Query() filters: AdminStatsDto) {
        return this.adminService.getStats(filters);
    }
    @Get('ledger')
    getLedgerHealth() {
        return this.adminService.getLedgerHealth();
    }
    @Get('health')
    getSystemHealth() {
        return this.adminService.getSystemHealth();
    }
}