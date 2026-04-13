import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
    constructor(private transactionsService: TransactionsService) { }

    // POST /api/v1/transactions — create a new transfer
    // Body: { quoteId: "uuid", recipientId: "uuid" }
    @Post()
    async create(
        @Request() req: any,
        @Body() body: { quoteId: string; recipientId: string },
    ) {
        return this.transactionsService.createTransaction(req.user.sub, body);
    }

    // GET /api/v1/transactions — list all your transactions
    @Get()
    async list(
        @Request() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.transactionsService.listTransactions(
            req.user.sub,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 20,
        );
    }

    // GET /api/v1/transactions/:id — get transaction details + timeline
    @Get(':id')
    async findOne(@Request() req: any, @Param('id') id: string) {
        return this.transactionsService.getTransaction(req.user.sub, id);
    }
}