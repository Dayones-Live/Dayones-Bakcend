import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../../user.module';
import { FeedbackController } from './controllers/feedback.controller';
import { FeedbackService } from './services/feedback.service';
import { Feedback } from './entitites/feedback.entity';
import { FeedbackMapper } from './dto/feedback.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback]), UserModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackMapper],
  exports: [FeedbackService],
})
export class FeedbackModule {}
