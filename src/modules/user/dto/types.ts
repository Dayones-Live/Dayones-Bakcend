import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Roles } from '@app/shared/constants/constants';

export class UserUpdateInput {
  @IsOptional()
  @IsEnum(Roles, { message: 'Role must be one of:  USER, ARTIST' })
  role?: Roles;

  @IsOptional()
  fullName?: string;

  @IsOptional()
  isConfirmed?: boolean;

  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  avatarUrl?: string;
}

export class UpdateUserLocationInput {
  @IsNotEmpty({ message: 'latitude is required' })
  latitude: string;

  @IsNotEmpty({ message: 'longitude is required' })
  longitude: string;
}
