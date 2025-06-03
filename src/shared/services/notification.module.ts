import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notifications]),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {} 