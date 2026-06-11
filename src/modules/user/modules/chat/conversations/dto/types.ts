import { PaginationResponse } from '@app/types';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { Conversations } from '../entities/conversation.entity';
import { Media_Type } from '@app/types';

export class CreateConversationInput {
  @IsNotEmpty({ message: 'recieverId is required' })
  recieverId: string;

  @IsOptional()
  lastMessage?: string;

  @IsOptional()
  mediaType?: Media_Type;

  @IsOptional()
  url?: string;
}

export class CreateConversation extends CreateConversationInput {
  @IsNotEmpty({ message: 'senderId is required' })
  senderId: string;

  @IsNotEmpty({ message: 'senderRecieverCode is required' })
  senderRecieverCode: string;
}

export class AllConversationResponse extends PaginationResponse {
  conversations: Conversations[];
}

export class UpdateConversationInput {
  @IsNotEmpty({ message: 'Conversation Id is required' })
  id: string;

  @IsNotEmpty({ message: 'lastMessage is required' })
  lastMessage: string;
}
