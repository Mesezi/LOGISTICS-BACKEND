import { IsDateString, IsOptional, Matches } from 'class-validator';

export class DailyReportDto {
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
