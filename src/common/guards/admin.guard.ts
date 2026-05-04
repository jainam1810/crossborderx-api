import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // JwtStrategy returns { sub, email } where `sub` is the user id.
        // Accept any of id/userId/sub so the guard isn't tied to a specific shape.
        const userId = user?.id ?? user?.userId ?? user?.sub;

        if (!userId) {
            throw new UnauthorizedException('Authentication required');
        }

        // Re-fetch from the DB so revoking admin status takes effect immediately,
        // even if the user's JWT is still valid.
        const freshUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, isAdmin: true },
        });

        if (!freshUser) {
            throw new UnauthorizedException('User no longer exists');
        }

        if (!freshUser.isAdmin) {
            throw new ForbiddenException('Admin access required');
        }

        // Mark the request as admin-authenticated so downstream code can rely on it.
        request.user.isAdmin = true;
        return true;
    }
}