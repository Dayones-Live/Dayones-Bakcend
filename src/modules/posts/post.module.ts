import { Module } from '@nestjs/common';
import { ArtistPostModule } from './modules/artist-post/artist-post.module';
import { ArtistPostUserModule } from './modules/artist-post-user/atrist-post.user.module';

@Module({
  imports: [ArtistPostModule, ArtistPostUserModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class PostModule {}
