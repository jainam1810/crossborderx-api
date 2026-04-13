import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    async register(
        @Body() body: { email: string; password: string; fullName: string; phone?: string },
    ) {
        return this.authService.register(body);
    }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.sub);
    }
}