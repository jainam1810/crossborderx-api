import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/quotes')
@UseGuards(JwtAuthGuard)
export class QuoteController {
    constructor(private quoteService: QuoteService) { }

    @Post()
    async createQuote(@Request() req: any, @Body() body: { sendAmount: number; sendCurrency: string; receiveCurrency: string }) {
        return this.quoteService.createQuote(req.user.sub, body);
    }

    @Get(':id')
    async getQuote(@Param('id') id: string) {
        return this.quoteService.getQuote(id);
    }
}