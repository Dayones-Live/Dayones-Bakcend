import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateReactionInput {
  @IsOptional()
  userId: string;

  @IsNotEmpty({ message: 'Artist post  User id is required' })
  artistPostUserId: string;
}
