import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comments } from './entities/comments.entity';
import { CommentsController } from './controllers/comments.controller';
import { CommentsService } from './services/commnets.service';
import { CommentsMapper } from './dto/comments.mapper';
import { UserModule } from '@app/modules/user/user.module';
import { ArtistPostUserModule } from '../artist-post-user/atrist-post-user.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { CommentReactionsModule } from '../comment-reactions/comment-reactions.module';
import { SharedModule } from '@app/shared/shared.module';
import { ArtistPostUser } from '../artist-post-user/entities/artist-post-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comments,
      ArtistPostUser,
    ]),
    forwardRef(() => UserModule),
    NotificationModule,
    ArtistPostUserModule,
    CommentReactionsModule,
    SharedModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsMapper],
  exports: [CommentsService],
})
export class CommentsModule {}
