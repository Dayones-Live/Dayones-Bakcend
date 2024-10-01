import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPostUser } from './entities/artist-post-user.entity';
import { ArtistPostUserService } from './services/artist-post-user.service';
import { ArtistPostUserController } from './controllers/artist-post-user.controller';
import { UserModule } from '@user/user.module';
import { ArtistPostUserMapper } from './dto/atrist-post-user.mapper';
@Module({
  imports: [TypeOrmModule.forFeature([ArtistPostUser]), UserModule],
  controllers: [ArtistPostUserController],
  providers: [ArtistPostUserService, ArtistPostUserMapper],
  exports: [ArtistPostUserService],
})
export class ArtistPostUserModule {}
