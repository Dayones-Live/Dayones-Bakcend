import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { Conversations } from '@app/modules/user/modules/chat/conversations/entities/conversation.entity';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { MessageService } from './services/message.service';
import { MessageController } from './controllers/message.controller';
import { MessageMapper } from './dto/message.mapper';
import { ConversationModule } from '@app/modules/user/modules/chat/conversations/conversation.module';
import { BlocksModule } from '@app/modules/user/modules/blocks/blocks.module';
import { SharedModule } from '@app/shared/shared.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { User } from '@app/modules/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversations, Notifications, User]),
    forwardRef(() => ConversationModule),
    forwardRef(() => NotificationModule),
    BlocksModule,
    SharedModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageMapper],
  exports: [MessageService],
})
export class MessageModule {} 