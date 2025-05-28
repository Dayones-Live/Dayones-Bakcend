import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@app/modules/user/user.module';
import { Message } from './entities/message.entity';
import { MessageController } from './controllers/message.controller';
import { MessageService } from './services/message.service';
import { MessageMapper } from './dto/message.mapper';
import { ConversationModule } from '../conversations/conversation.module';
import { SocketModule } from '@app/modules/user/modules/socket/socket.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { BlocksModule } from '@app/modules/user/modules/blocks/blocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    forwardRef(() => UserModule),
    forwardRef(() => ConversationModule),
    forwardRef(() => SocketModule),
    forwardRef(() => NotificationModule),
    BlocksModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageMapper],
  exports: [MessageService],
})
export class MessageModule {}
