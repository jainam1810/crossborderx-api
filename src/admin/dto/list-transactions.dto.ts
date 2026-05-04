import { IsOptional, IsString, IsNumberString, IsDateString } from 'class-validator';

export class AdminListTransactionsDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    userEmail?: string;

    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;

    @IsOptional()
    @IsNumberString()
    minAmount?: string;

    @IsOptional()
    @IsNumberString()
    maxAmount?: string;

    @IsOptional()
    @IsNumberString()
    page?: string;

    @IsOptional()
    @IsNumberString()
    limit?: string;
}