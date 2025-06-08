import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPostUser } from './entities/artist-post-user.entity';
import { ArtistPostUserService } from './services/artist-post-user.service';
import { UserModule } from '@user/user.module';
import { ArtistPostUserMapper } from './dto/atrist-post-user.mapper';
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistPostUser, ArtistPost]),
    forwardRef(() => UserModule),
  ],
  controllers: [],
  providers: [ArtistPostUserService, ArtistPostUserMapper],
  exports: [ArtistPostUserService],
})
export class ArtistPostUserModule {}
