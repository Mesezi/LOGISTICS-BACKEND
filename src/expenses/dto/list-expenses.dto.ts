import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ExpenseOwner } from '../../generated/prisma/client.js';

export class ListExpensesDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ExpenseOwner)
  owner?: ExpenseOwner;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rider_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  client_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  job_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
