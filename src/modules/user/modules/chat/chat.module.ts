import { Module } from '@nestjs/common';
import { ConversationModule } from './conversations/conversation.module';
import { MessageModule } from './messages/messages.module';

@Module({
  imports: [ConversationModule, MessageModule],
})
export class ChatModule {}
