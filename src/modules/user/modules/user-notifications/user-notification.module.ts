import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserNotification } from './entities/user-notifications.entity';
import { UserNotificationService } from './services/user-notification.service';
import { UserModule } from '../../user.module';
import { UserNotificationController } from './controller/user-notification.controller';
import { UserNotificationMapper } from './dto/user-notification.mapper';

@Module({
  imports: [TypeOrmModule.forFeature([UserNotification]), UserModule],
  controllers: [UserNotificationController],
  providers: [UserNotificationService, UserNotificationMapper],
  exports: [UserNotificationService],
})
export class UserNotificationModule {}
