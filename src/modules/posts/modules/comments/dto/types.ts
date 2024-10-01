import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCommentInput {
  @IsOptional()
  artistPostUserId: string;

  @IsNotEmpty({ message: 'Message is required' })
  message: string;
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
