import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListAuditLogDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  table_name?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  record_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
