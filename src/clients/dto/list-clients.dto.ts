import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { Type } from 'class-transformer';

export class ListClientsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  query = '';


  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mine = false;
}