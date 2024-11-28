import { PaginationResponse } from '@app/types';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Blocks } from '../entities/blocks.entity';

export class BlockUserInput {
  @IsOptional()
  blockedBy: string;

  @IsNotEmpty({ message: 'Blocked User Id is required' })
  blockedUser: string;
}

export class AllBlockedUserResponse extends PaginationResponse {
  @IsOptional()
  blocked_users: Blocks[];
}
