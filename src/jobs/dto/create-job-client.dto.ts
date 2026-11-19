import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
