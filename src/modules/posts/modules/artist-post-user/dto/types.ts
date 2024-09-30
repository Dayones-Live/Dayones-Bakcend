import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Invite_Status } from '../constants/constants';

export class CreateArtistPostUserInput {
  @IsOptional()
  user_id: string;

  @IsNotEmpty({ message: 'Artist post id is required' })
  artist_post_id: string;

  @IsNotEmpty({ message: 'Valid till is required' })
  valid_till: Date;

  @IsNotEmpty({ message: 'Invite Status is required' })
  status: Invite_Status;
}

export class UpdateArtistPostUserInput {
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
  id: string;

  @IsOptional()
  user_id: string;

  @IsOptional()
  artist_post_id: string;

  @IsOptional()
  valid_till: Date;

  @IsOptional()
  status: Invite_Status;
}
