import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPostController } from './controllers/artist-post.controller';
import { ArtistPostService } from './services/artist-post.service';
import { ArtistPost } from './entities/artist-post.entity';
import { UserModule } from '@user/user.module';
import { ArtistPostMapper } from './dto/artist-post.mapper';
import { ArtistPostUserModule } from '../artist-post-user/atrist-post-user.module';
import { CommentsModule } from '../comments/comments.module';
import { ReactionsModule } from '../reactions/reactions.module';
import { InvitesController } from './controllers/invites.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistPost]),
    UserModule,
    ArtistPostUserModule,
    CommentsModule,
    ReactionsModule,
  ],
  controllers: [ArtistPostController, InvitesController],
  providers: [ArtistPostService, ArtistPostMapper],
  exports: [ArtistPostService],
})
export class ArtistPostModule {}
