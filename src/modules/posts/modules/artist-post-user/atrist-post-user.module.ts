import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPostUser } from './entities/artist-post-user.entity';
import { ArtistPostUserService } from './services/artist-post-user.service';
import { UserModule } from '@user/user.module';
import { ArtistPostUserMapper } from './dto/atrist-post-user.mapper';
@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistPostUser]),
    forwardRef(() => UserModule),
  ],
  controllers: [],
  providers: [ArtistPostUserService, ArtistPostUserMapper],
  exports: [ArtistPostUserService],
})
export class ArtistPostUserModule {}
