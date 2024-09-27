import { Module } from '@nestjs/common';
import { ArtistPostModule } from './modules/artist-post/artist.post.module';

@Module({
  imports: [ArtistPostModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class PostModule {}
