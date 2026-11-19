import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../generated/prisma/client.js';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
