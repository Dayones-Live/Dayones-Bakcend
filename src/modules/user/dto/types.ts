import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Roles } from 'src/shared/constants';

export class UserUpdateInput {
  @IsOptional()
  @IsEnum(Roles, { message: 'Role must be one of:  USER, ARTIST' })
  role?: Roles;

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
