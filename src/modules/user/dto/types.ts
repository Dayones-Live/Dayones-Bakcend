import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ROLES } from 'src/shared/constants';

export class UserUpdateInput {
  @IsOptional()
  @IsEnum(ROLES, { message: 'Role must be one of:  USER, ARTIST' })
  role?: ROLES;

  @IsOptional()
  full_name?: string;

  @IsOptional()
  is_confirmed?: boolean;

  @IsOptional()
  phone_number?: string;

  @IsOptional()
  avatar_url?: string;
}

export class UpdateUserLocationInput {
  @IsNotEmpty({ message: 'latitude is required' })
  latitude: string;

  @IsNotEmpty({ message: 'longitude is required' })
  longitude: string;
}
