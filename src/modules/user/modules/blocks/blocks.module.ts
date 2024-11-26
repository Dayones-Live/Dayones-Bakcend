import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@user/user.module';
import { Blocks } from './entities/blocks.entity';
import { BlocksController } from './controllers/blocks.controller';
import { BlocksService } from './services/blocks.service';
import { BlocksMapper } from './dto/blocks.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Blocks]), UserModule],
  controllers: [BlocksController],
  providers: [BlocksMapper, BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
