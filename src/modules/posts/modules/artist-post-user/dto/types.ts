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

export class AllUserDataObject {
  @IsOptional()
  artistPostUser: ArtistPostUser[];

  @IsOptional()
  user: User;
}
