import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CommentReactionInput {
  @IsOptional()
  likedBy: string;

  @IsNotEmpty({ message: 'Message is required' })
  commentId: string;
}
