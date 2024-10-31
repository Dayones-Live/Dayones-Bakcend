import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateReactionInput {
  @IsOptional()
  artistPostUserId: string;

  @IsOptional()
  reactBy?: string;
}
