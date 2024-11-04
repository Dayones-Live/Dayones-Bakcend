import { Media_Type } from '@app/shared/constants/constants';
import { IsNotEmpty, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateCommentInput {
  @IsOptional()
  artistPostUserId?: string;

  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @IsOptional()
  commentBy?: string;

  @IsOptional()
  parentCommentId?: string;

  @IsOptional()
  url?: string;

  @IsOptional()
  mediaType?: Media_Type;
}

export class UpdateCommentInput {
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
  id: string;

  @IsOptional()
  userId: string;

  @IsOptional()
  artistPostUserId: string;

  @IsOptional()
  message: string;
}
