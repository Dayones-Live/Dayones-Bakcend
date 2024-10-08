import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationController } from './controllers/conversation.controller';
import { ConversationService } from './services/conversation.service';
import { Conversations } from './entities/conversation.entity';
import { ConversationMapper } from './dto/conversation.mapper';
import { UserModule } from '@app/modules/user/user.module';
import { MessageModule } from '../messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversations]),
    forwardRef(() => UserModule),
    forwardRef(() => MessageModule),
  ],
  controllers: [ConversationController],
  providers: [ConversationService, ConversationMapper],
  exports: [ConversationService],
})
export class ConversationModule {}
