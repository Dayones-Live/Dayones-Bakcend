import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notifications } from './entities/notifications.entity';
import { NotificationMapper } from './dto/notifications.mapper';
import { NotificationsController } from './controllers/notifications.controller';
import { UserModule } from '@app/modules/user/user.module';
import { UserNotificationModule } from '@app/modules/user/modules/user-notifications/user-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
    forwardRef(() => UserModule),
    UserNotificationModule,
  ],
  providers: [NotificationMapper],
  controllers: [NotificationsController],
  exports: [TypeOrmModule],
})
export class NotificationModule {}
