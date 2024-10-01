import { Module } from '@nestjs/common';
import { ArtistPostModule } from './modules/artist-post/artist-post.module';
import { ArtistPostUserModule } from './modules/artist-post-user/atrist-post.user.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { CommentsModule } from './modules/comments/comments.module';

@Module({
  imports: [
    ArtistPostModule,
    ArtistPostUserModule,
    ReactionsModule,
    CommentsModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class PostModule {}
