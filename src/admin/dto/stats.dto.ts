import { IsOptional, IsNumberString } from 'class-validator';

export class AdminStatsDto {
    @IsOptional()
    @IsNumberString()
    days?: string;
}