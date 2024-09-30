import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistPostController } from './controllers/artist-post.controller';
import { ArtistPostService } from './services/artist-post.service';
import { ArtistPost } from './entities/artist-post.entity';
import { UserModule } from '@user/user.module';
import { ArtistPostMapper } from './dto/artist-post.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistPost]), UserModule],
  controllers: [ArtistPostController],
  providers: [ArtistPostService, ArtistPostMapper],
  exports: [ArtistPostService],
})
export class ArtistPostModule {}
