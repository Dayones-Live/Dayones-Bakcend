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

export class FetchNearByUsersInput {
  @IsNotEmpty({ message: 'Latitude is required' })
  latitude: number;

  @IsNotEmpty({ message: 'Longitude is required' })
  longitude: number;

  @IsNotEmpty({ message: 'Radius in meter is required' })
  radiusInMeters: number;

  @IsNotEmpty({ message: 'Current Logged in user id is required' })
  currentUserId: string;
}

export class UpdateUserLocationAndNotificationInput {
  @IsNotEmpty({ message: 'latitude is required' })
  latitude: string;

  @IsNotEmpty({ message: 'longitude is required' })
  longitude: string;

  @IsNotEmpty({ message: 'Notification enabled is required' })
  notificationsEnabled: boolean;
}
