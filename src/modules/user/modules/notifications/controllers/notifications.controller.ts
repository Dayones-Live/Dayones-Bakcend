import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { NotificationMapper } from '../dto/notifications.mapper';
import { Notifications } from '../entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '@app/shared/services/notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { NotificationBundlingService } from '@app/shared/services/notification-bundling.service';
import { ApiTags } from '@nestjs/swagger';
import { NOTIFICATION_TYPE, NOTIFICATION_TITLE } from '../constants';
import { Roles } from '@app/shared/constants/constants';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(CognitoGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
    private notificationService: NotificationService,
    private userDeviceService: UserDeviceService,
    private pushNotificationService: PushNotificationService,
    private notificationBundlingService: NotificationBundlingService,
  ) {}

  @Post('test-bundling')
  async testNotificationBundling(
    @Res() res: Response,
    @Req() req: Request,
    @Body()
    body: {
      postId: string;
      numInteractions: number;
      interactionType: typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];
      delayBetweenMs?: number;
    }
  ) {
    try {
      const { postId, numInteractions, interactionType, delayBetweenMs = 1000 } = body;
      const results = [];

      // Create multiple notifications with delays
      for (let i = 0; i < numInteractions; i++) {
        const notification = new Notifications();
        notification.to_id = req?.user?.id;
        notification.from_id = req?.user?.id;
        notification.post_id = postId;
        notification.title = NOTIFICATION_TITLE[interactionType];
        notification.type = interactionType;
        notification.is_read = false;
        notification.message = `Test interaction ${i + 1}`;
        notification.data = JSON.stringify({
          test: true,
          interaction_number: i + 1
        });

        const savedNotification = await this.notificationsRepository.save(notification);
        results.push(savedNotification);

        // Get active OneSignal player IDs
        const playerIds = await this.userDeviceService.getActivePlayerIds(req?.user?.id);
        
        if (playerIds.length > 0) {
          await this.pushNotificationService.sendPushNotification(
            playerIds,
            notification.title,
            notification.message,
            {
              type: notification.type,
              post_id: notification.post_id,
              notification_id: savedNotification.id
            }
          );
        }

        // Wait for the specified delay
        await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
      }

      // Check if bundling occurred
      const bundledNotifications = await this.notificationsRepository.find({
        where: {
          to_id: req?.user?.id,
          post_id: postId,
          is_bundled: true
        }
      });

      res.status(HttpStatus.OK).json({
        message: 'Test notifications sent',
        data: {
          individual_notifications: results,
          bundled_notifications: bundledNotifications
        }
      });
    } catch (error) {
      console.error('Error in test notification bundling:', error);
      throw error;
    }
  }

  @Post('test')
  async testNotification(@Res() res: Response, @Req() req: Request) {
    try {
      const notification = new Notifications();
      notification.to_id = req?.user?.id;
      notification.from_id = req?.user?.id;
      notification.title = 'Test Notification';
      notification.message = 'This is a test notification';
      notification.type = 'message';
      notification.is_read = false;
      notification.data = JSON.stringify({ test: true });

      const savedNotification = await this.notificationsRepository.save(notification);
      
      // Get active OneSignal player IDs for the user
      const playerIds = await this.userDeviceService.getActivePlayerIds(req?.user?.id);
      
      if (playerIds.length > 0) {
        await this.pushNotificationService.sendPushNotification(
          playerIds,
          notification.title,
          notification.message,
          {
            type: notification.type,
            notification_id: savedNotification.id
          }
        );
        res.status(HttpStatus.OK).json({
          message: 'Test notification sent successfully',
          data: savedNotification,
        });
      } else {
        res.status(HttpStatus.OK).json({
          message: 'Test notification saved but no active devices found',
          data: savedNotification,
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  @Get()
  async getAllUserNotification(@Res() res: Response, @Req() req: Request) {
    try {
      const notifications = await this.notificationsRepository.find({
        where: { to_id: req?.user?.id },
        order: { created_at: 'DESC' },
        relations: ['fromUser'],
      });
      
      const response = notifications.map(notification => ({
        ...this.notificationMapper.toDto(notification),
        from_user_profile: notification.fromUser ? {
          id: notification.fromUser.id,
          full_name: notification.fromUser.full_name,
          avatar_url: notification.fromUser.avatar_url
        } : null
      }));

      res.status(HttpStatus.OK).json({
        message: 'Notifications Fetched Successfully',
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ NotificationsController ~ getAllUserNotification ~ error:',
        error,
      );
      throw error;
    }
  }

  @Patch(':id')
  async updateIsRead(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const notification = await this.notificationsRepository.findOne({
        where: { id, to_id: req?.user?.id },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      notification.is_read = true;
      const updatedNotification = await this.notificationsRepository.save(notification);
      
      // Get active OneSignal player IDs for the user
      const playerIds = await this.userDeviceService.getActivePlayerIds(req?.user?.id);
      
      if (playerIds.length > 0) {
        // Reset badge count when notification is marked as read
        await this.notificationService.resetBadgeCount(playerIds);
      }
      
      res
        .status(HttpStatus.OK)
        .json({ 
          message: 'Notification Updated Successfully', 
          data: this.notificationMapper.toDto(updatedNotification) 
        });
    } catch (error) {
      console.error(
        '🚀 ~ NotificationsController ~ updateIsRead ~ error:',
        error,
      );
      throw error;
    }
  }
}
