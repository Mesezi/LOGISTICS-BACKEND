import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateJobClientDto } from './create-job-client.dto.js';
import { CreateJobPartnerDto } from './create-job-partner.dto.js';

export class CreateJobDto {
  @ValidateIf((o) => !o.client_name && !o.client)
  @IsInt()
  @Type(() => Number)
  client_id?: number;

  @ValidateIf((o) => !o.client_id && !o.client)
  @IsString()
  @IsNotEmpty()
  client_name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateJobClientDto)
  client?: CreateJobClientDto;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  rider_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  partner_id?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateJobPartnerDto)
  partner?: CreateJobPartnerDto;

  @IsString()
  @IsNotEmpty()
  pickup: string;

  @IsString()
  @IsNotEmpty()
  dropoff: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  job_date?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  office_fee: number;

  @IsOptional()
  @IsString()
  sublet_name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sublet_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  park_waybill?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  partner_amount?: number;
}
