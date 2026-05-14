import { ApiHideProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateReactionInput {
  @ApiHideProperty()
  @IsOptional()
  artistPostUserId?: string;

  @ApiHideProperty()
  @IsOptional()
  reactBy?: string;
}
