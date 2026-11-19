import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ReportDateRangeDto } from './report-date-range.dto.js';

export class ClientStatementDto extends ReportDateRangeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  client_id: number;
}
