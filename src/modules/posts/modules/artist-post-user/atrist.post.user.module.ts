import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@app/modules/user/user.module';
import { ArtistPostUser } from './entities/artist.post.user.entity';
import { ArtistPostUserService } from './services/artist.post.user.service';
import { ArtistPostUserController } from './controllers/artist.post.user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistPostUser]), UserModule],
  controllers: [ArtistPostUserController],
  providers: [ArtistPostUserService],
  exports: [ArtistPostUserService],
})
export class ArtistPostUserModule {}
