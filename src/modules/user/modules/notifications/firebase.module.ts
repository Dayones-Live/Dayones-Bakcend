import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseService } from './services/notification.service';
import { Notifications } from './entities/notifications.entity';
import { NotificationMapper } from './dto/notifications.mapper';
import { UserNotificationModule } from '@app/modules/user/modules/user-notifications/user-notification.module';
import { UserModule } from '@app/modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
    UserNotificationModule,
    forwardRef(() => UserModule),
  ],
  providers: [FirebaseService, NotificationMapper],
  exports: [FirebaseService],
})
export class FirebaseModule {} 