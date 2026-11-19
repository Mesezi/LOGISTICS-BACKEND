import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { Type } from 'class-transformer';

export class ListRidersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  query = '';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
