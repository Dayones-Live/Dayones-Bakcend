import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reactions } from './entities/reaction.entity';
import { UserModule } from '@app/modules/user/user.module';
import { ReactionService } from './services/reactions.service';
import { ReactionsMapper } from './dto/reaction.mapper';
import { ReactionsController } from './controllers/reaction.controller';
import { ArtistPostUserModule } from '../artist-post-user/atrist-post-user.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { SharedModule } from '@app/shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reactions]),
    forwardRef(() => UserModule),
    ArtistPostUserModule,
    NotificationModule,
    SharedModule,
  ],
  controllers: [ReactionsController],
  providers: [ReactionService, ReactionsMapper],
  exports: [ReactionService],
})
export class ReactionsModule {}
