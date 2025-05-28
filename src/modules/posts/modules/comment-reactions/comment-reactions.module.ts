import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentReactions } from './entities/comment-reaction.entity';
import { CommentReactionsService } from './services/comment-reaction.service';
import { CommentReactionMapper } from './dto/comment-reaction.mapper';
import { CommentsModule } from '../comments/comments.module';
import { FirebaseModule } from '@app/modules/user/modules/notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentReactions]),
    forwardRef(() => CommentsModule),
    FirebaseModule,
  ],
  controllers: [],
  providers: [CommentReactionsService, CommentReactionMapper],
  exports: [CommentReactionsService],
})
export class CommentReactionsModule {}
