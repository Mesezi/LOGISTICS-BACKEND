import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { JobStatus } from '../../generated/prisma/client.js';

export class ListJobsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  client_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rider_id?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unpaid?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  has_sublet?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  has_partner?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  partner_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
