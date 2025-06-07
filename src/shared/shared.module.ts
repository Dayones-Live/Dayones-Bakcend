import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { NotificationService } from './services/notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationBundlingService } from './services/notification-bundling.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
    ConfigModule,
  ],
  providers: [NotificationService, PushNotificationService, NotificationBundlingService],
  exports: [NotificationService, PushNotificationService, NotificationBundlingService],
})
export class SharedModule {} 