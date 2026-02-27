import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';

@Module({
  providers: [PrintfulService],
  exports: [PrintfulService],
})
export class PrintfulModule {}
