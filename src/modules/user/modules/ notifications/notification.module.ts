import { Module } from '@nestjs/common';
import { FirebaseService } from './services/notification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notifications } from './entities/notifications.entity';
import { NotificationMapper } from './dto/notifications.mapper';
import { NotificationsController } from './controllers/notifications.controller';
import { UserModule } from '../../user.module';
import { UserNotificationModule } from '../user-notifications/user-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
    UserModule,
    UserNotificationModule,
  ],
  providers: [FirebaseService, NotificationMapper],
  controllers: [NotificationsController],
  exports: [FirebaseService], // Export the service for use in other modules
})
export class FirebaseModule {}
