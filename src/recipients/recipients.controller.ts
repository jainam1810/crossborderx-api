import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RecipientsService } from './recipients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/recipients')
@UseGuards(JwtAuthGuard)
export class RecipientsController {
    constructor(private recipientsService: RecipientsService) { }

    // POST /api/v1/recipients — add a new recipient
    @Post()
    async create(
        @Request() req: any,
        @Body() body: { fullName: string; sortCode: string; accountNumber: string; bankName?: string },
    ) {
        return this.recipientsService.create(req.user.sub, body);
    }

    // GET /api/v1/recipients — list all your recipients
    @Get()
    async findAll(@Request() req: any) {
        return this.recipientsService.findAll(req.user.sub);
    }

    // DELETE /api/v1/recipients/:id — remove a recipient
    @Delete(':id')
    async delete(@Request() req: any, @Param('id') id: string) {
        return this.recipientsService.delete(req.user.sub, id);
    }
}