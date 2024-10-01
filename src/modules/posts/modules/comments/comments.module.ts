import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comments } from './entities/comments.entity';
import { CommentsController } from './controllers/comments.controller';
import { CommentsService } from './services/commnets.service';
import { CommentsMapper } from './dto/comments.mapper';
import { UserModule } from '@app/modules/user/user.module';
import { ArtistPostUserModule } from '../artist-post-user/atrist-post-user.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Comments]),
    UserModule,
    ArtistPostUserModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsMapper],
  exports: [CommentsService],
})
export class CommentsModule {}
