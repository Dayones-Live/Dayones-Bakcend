import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { Message } from '../entities/message.entity';
import { PaginationDto, PaginationResponse } from '@app/types';
import { Media_Type } from '@app/types';

export class SendMessageInput {
  @IsNotEmpty({ message: 'Conversation ID is required' })
  conversationId: string;

  @ValidateIf((o) => !o.mediaType)
  @IsNotEmpty({ message: 'Message content is required when no media is attached' })
  message?: string;

  @IsOptional()
  url?: string;

  @IsOptional()
  mediaType?: Media_Type;
}

export class SendMessage extends SendMessageInput {
  @IsNotEmpty({ message: 'senderId is required' })
  senderId: string;
}

export class GetAllMessagesDto extends PaginationDto {
  conversationId: string;
}

export class AllMessageResponse extends PaginationResponse {
  messages: Message[];
}
