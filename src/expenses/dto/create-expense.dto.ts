import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseOwner, PayMode } from '../../generated/prisma/client.js';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsEnum(PayMode)
  mode: PayMode;

  @ValidateIf((o) => o.mode === 'transfer')
  @IsString()
  @IsNotEmpty()
  bank_name?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsEnum(ExpenseOwner)
  owner: ExpenseOwner;

  @ValidateIf((o) => o.owner === 'rider')
  @IsInt()
  @Type(() => Number)
  rider_id?: number;

  @ValidateIf((o) => o.owner === 'client')
  @IsInt()
  @Type(() => Number)
  client_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  job_id?: number;

  @IsOptional()
  @IsDateString()
  expense_date?: string;
}
