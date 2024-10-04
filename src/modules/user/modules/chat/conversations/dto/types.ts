import { PaginationResponse } from '@app/types';
import { IsNotEmpty } from 'class-validator';
import { Conversations } from '../entities/conversation.entity';

export class CreateConversationInput {
  @IsNotEmpty({ message: 'recieverId is required' })
  recieverId: string;

  @IsNotEmpty({ message: 'lastMessage is required' })
  lastMessage: string;
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
