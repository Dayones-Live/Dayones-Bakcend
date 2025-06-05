import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reactions } from './entities/reaction.entity';
import { UserModule } from '@app/modules/user/user.module';
import { ReactionService } from './services/reactions.service';
import { ReactionsController } from './controllers/reaction.controller';
import { ReactionsMapper } from './dto/reaction.mapper';
import { ArtistPostUserModule } from '../artist-post-user/artist-post-user.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { SharedModule } from '@app/shared/shared.module';
import { ArtistPost } from '../artist-post/entities/artist-post.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reactions, ArtistPost]),
    forwardRef(() => UserModule),
    forwardRef(() => ArtistPostUserModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => SharedModule),
  ],
  controllers: [ReactionsController],
  providers: [ReactionService, ReactionsMapper],
  exports: [ReactionService],
})
export class ReactionsModule {}
