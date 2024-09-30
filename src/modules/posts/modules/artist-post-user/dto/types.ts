import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Invite_Status } from '../constants/constants';

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
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
  id: string;

  @IsOptional()
  userId: string;

  @IsOptional()
  artistPostId: string;

  @IsOptional()
  validTill: Date;

  @IsOptional()
  status: Invite_Status;
}
