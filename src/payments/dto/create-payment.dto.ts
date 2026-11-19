import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PayMode } from '../../generated/prisma/client.js';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsEnum(PayMode)
  mode: PayMode;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDateString()
  paid_at?: string;
}
