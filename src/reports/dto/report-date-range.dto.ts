import { IsDateString, IsOptional, Matches } from 'class-validator';

export class ReportDateRangeDto {
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start_date?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end_date?: string;
}
