import { Media_Type } from '@app/types';
import { IsNotEmpty, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateCommentInput {
  @IsOptional()
  artistPostUserId?: string;

  @ValidateIf((o) => !o.url)
  @IsNotEmpty({ message: 'Message is required when no photo is provided' })
  message?: string;

  @IsOptional()
  commentBy?: string;

  @IsOptional()
  parentCommentId?: string;

  @ValidateIf((o) => !o.message || o.message === '')
  @IsNotEmpty({ message: 'Photo is required when no message is provided' })
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
