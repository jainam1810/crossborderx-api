import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminListTransactionsDto } from './dto/list-transactions.dto';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('transactions')
    listTransactions(@Query() filters: AdminListTransactionsDto) {
        return this.adminService.listTransactions(filters);
    }
}