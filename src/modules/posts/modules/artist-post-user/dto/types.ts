import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { INVITE_STATUS } from '../constants/constants';

export class CreateArtistPostUserInput {
  @IsOptional()
  user_id: string;

  @IsNotEmpty({ message: 'Artist post id is required' })
  artist_post_id: string;

  @IsNotEmpty({ message: 'Valid till is required' })
  valid_till: Date;

  @IsNotEmpty({ message: 'Invite Status is required' })
  status: INVITE_STATUS;
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
  status: INVITE_STATUS;
}
