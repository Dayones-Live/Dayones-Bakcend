import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ROLES } from 'src/shared/constants';

export class UserUpdateInput {
  @IsNotEmpty({ message: 'Id is required' })
  id: string;

  @IsOptional()
  @IsEnum(ROLES, { message: 'Role must be one of:  USER, ARTIST' })
  role: ROLES;

  @IsOptional()
  name: string;

  @IsOptional()
  is_confirmed: boolean;

  @IsOptional()
  latitude: string;

  @IsOptional()
  longitude: string;

  @IsOptional()
  avatar_url: string;

  @IsOptional()
  notification_token: string;
}
