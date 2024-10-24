import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Invite_Status } from '../constants/constants';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import { User } from '@user/entities/user.entity';
export class CreateArtistPostUserInput {
  @IsOptional()
  userId: string;

  @IsNotEmpty({ message: 'Artist post id is required' })
  artistPostId: string;

  @IsNotEmpty({ message: 'Valid till is required' })
  validTill: Date;

  @IsNotEmpty({ message: 'Invite Status is required' })
  status: Invite_Status;
}

export class UpdateArtistPostUserInput {
  @IsOptional()
  id: string;

  @IsOptional()
  userId: string;

  @IsOptional()
  artistPostId: string;

  @IsOptional()
  validTill: Date;

  @IsNotEmpty({ message: 'Status is Required' })
  status: Invite_Status;
}

export class UserInvitesResponse {
  @IsOptional()
  id: string;

  @IsOptional()
  user_id: string;

  @IsOptional()
  artist_post_id: string;

  @IsOptional()
  valid_till: Date;

  @IsOptional()
  status: string;

  @IsOptional()
  created_at: Date;

  @IsOptional()
  updated_at: Date;

  @IsOptional()
  user: User;
}

export class CommentsWithUserResponse {
  @IsOptional()
  id: string;

  @IsOptional()
  artist_post_user_id: string;

  @IsOptional()
  message: string;

  @IsOptional()
  created_at: Date;

  @IsOptional()
  updated_at: Date;

  @IsOptional()
  commentReactionCount?: number;

  @IsOptional()
  user: Partial<User>;
}

export class ReactionsWithUserResponse {
  @IsOptional()
  id: string;

  @IsOptional()
  artist_post_user_id: string;

  @IsOptional()
  created_at: Date;

  @IsOptional()
  updated_at: Date;

  @IsOptional()
  user: Partial<User>;
}
