import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { NotificationService } from './services/notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notifications]),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class SharedModule {} 