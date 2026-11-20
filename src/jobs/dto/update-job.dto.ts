import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { JobStatus } from '../../generated/prisma/client.js';
import { CreateJobDto } from './create-job.dto.js';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
