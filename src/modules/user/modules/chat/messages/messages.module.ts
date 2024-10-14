import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@app/modules/user/user.module';
import { Message } from './entities/message.entity';
import { MessageController } from './controllers/message.controller';
import { MessageService } from './services/message.service';
import { MessageMapper } from './dto/message.mapper';
import { ConversationModule } from '../conversations/conversation.module';
import { SocketModule } from '../../socket/socket.module';
import { FirebaseModule } from '../../ notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    forwardRef(() => UserModule),
    forwardRef(() => ConversationModule),
    forwardRef(() => SocketModule),
    FirebaseModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageMapper],
  exports: [MessageService],
})
export class MessageModule {}
