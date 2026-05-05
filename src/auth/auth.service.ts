import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
    ) { }

    async register(dto: { email: string; password: string; fullName: string; phone?: string }) {
        // Check if user already exists
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new BadRequestException('Email already registered');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(dto.password, 10);

        // Create user
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                fullName: dto.fullName,
                phone: dto.phone || null,
            },
        });

        return { userId: user.id, message: 'Registration successful' };
    }

    async login(dto: { email: string; password: string }) {
        // Find user
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Check password
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Generate tokens
        const payload = { sub: user.id, email: user.email };
        const accessToken = this.jwt.sign(payload);
        const refreshToken = this.jwt.sign(payload, { expiresIn: '7d' });

        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
        };
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException();

        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            kycStatus: user.kycStatus,
            tier: user.tier,
            isAdmin: user.isAdmin,
        };
    }
}