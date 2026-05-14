import { ApiHideProperty } from '@nestjs/swagger';
import { PaginationResponse } from '@app/types';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Blocks } from '../entities/blocks.entity';

export class BlockUserInput {
  @ApiHideProperty()
  @IsOptional()
  blockedBy?: string;

  @IsNotEmpty({ message: 'Blocked User Id is required' })
  @IsUUID(undefined, { message: 'Blocked User Id must be a valid UUID' })
  blockedUser: string;
}

export class AllBlockedUserResponse extends PaginationResponse {
  @IsOptional()
  blocked_users?: Blocks[];
}
