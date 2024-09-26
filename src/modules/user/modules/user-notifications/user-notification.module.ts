import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserNotification } from './entities/user-notifications.entity';
import { UserNotificationService } from './services/user-notification.service';
import { UserModule } from '../../user.module';
import { UserNotificationController } from './controller/user-notification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserNotification]), UserModule],
  controllers: [UserNotificationController],
  providers: [UserNotificationService],
  exports: [UserNotificationService],
})
export class UserNotificationModule {}
