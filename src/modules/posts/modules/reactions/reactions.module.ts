import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reactions } from './entities/reaction.entity';
import { UserModule } from '@app/modules/user/user.module';
import { ReactionService } from './services/reactions.service';
import { ReactionsMapper } from './dto/reaction.mapper';
import { ReactionsController } from './controllers/reaction.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Reactions]), UserModule],
  controllers: [ReactionsController],
  providers: [ReactionService, ReactionsMapper],
  exports: [ReactionService],
})
export class ReactionsModule {}
