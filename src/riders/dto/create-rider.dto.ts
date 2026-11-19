import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRiderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
