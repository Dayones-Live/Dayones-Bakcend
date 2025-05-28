import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseService } from './services/notification.service';
import { Notifications } from './entities/notifications.entity';
import { NotificationMapper } from './dto/notifications.mapper';
import { UserNotificationModule } from '../../user-notifications/user-notification.module';
import { UserModule } from '../../user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
    UserNotificationModule,
    UserModule,
  ],
  providers: [FirebaseService, NotificationMapper],
  exports: [FirebaseService],
})
export class FirebaseModule {} 