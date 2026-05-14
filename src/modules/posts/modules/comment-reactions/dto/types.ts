import { ApiHideProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CommentReactionInput {
  @ApiHideProperty()
  @IsOptional()
  likedBy?: string;

  @IsNotEmpty({ message: 'Comment id is required' })
  commentId: string;
}
