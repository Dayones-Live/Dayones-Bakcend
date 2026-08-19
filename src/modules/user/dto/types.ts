import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { AgeBracket, Roles } from '@app/shared/constants/constants';

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

  @IsOptional()
  isDeleted?: boolean;
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

export class ApproveArtistInput {
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsOptional()
  adminNotes?: string;
}

export class RejectArtistInput {
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @IsOptional()
  adminNotes?: string;
}

/**
 * The one-time age declaration.
 *
 * Only the bracket crosses the wire. When the birthday re-check strategy is
 * active the app derives the bracket from the date locally and sends the
 * result, so a date of birth never reaches the server and cannot be stored,
 * logged, or captured in a request trace.
 */
export class SetAgeBracketInput {
  @IsNotEmpty({ message: 'ageBracket is required' })
  @IsEnum(AgeBracket, {
    message: 'ageBracket must be one of: UNDER_13, AGE_13_17, AGE_18_PLUS',
  })
  ageBracket: AgeBracket;
}
