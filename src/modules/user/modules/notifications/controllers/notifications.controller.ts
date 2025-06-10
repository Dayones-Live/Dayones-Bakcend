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
  Delete,
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
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { NOTIFICATION_TYPE, NOTIFICATION_TITLE } from '../constants';
import { Roles } from '@app/shared/constants/constants';
import { Logger } from '@nestjs/common';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(CognitoGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

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
      this.logger.log(`[FETCH_NOTIFICATIONS] Fetching notifications for user ${req?.user?.id}`);
      
      const notifications = await this.notificationsRepository.find({
        where: { to_id: req?.user?.id },
        order: { created_at: 'DESC' },
        relations: ['fromUser'],
      });
      
      this.logger.log(`[FETCH_NOTIFICATIONS] Found ${notifications.length} notifications for user ${req?.user?.id}`);
      
      const response = notifications.map(notification => ({
        ...this.notificationMapper.toDto(notification),
        from_user_profile: notification.fromUser ? {
          id: notification.fromUser.id,
          full_name: notification.fromUser.full_name,
          avatar_url: notification.fromUser.avatar_url
        } : null
      }));

      // Get unread count for badge
      const unreadCount = notifications.filter(n => !n.is_read).length;
      this.logger.log(`[FETCH_NOTIFICATIONS] User ${req?.user?.id} has ${unreadCount} unread notifications`);

      // Only update badge count if there are unread notifications
      if (unreadCount > 0) {
        // Get active OneSignal player IDs for the user
        const playerIds = await this.userDeviceService.getActivePlayerIds(req?.user?.id);
        
        if (playerIds.length > 0) {
          this.logger.log(`[FETCH_NOTIFICATIONS] Updating badge count for user ${req?.user?.id} with player IDs: ${playerIds.join(', ')}`);
          await this.notificationService.updateBadgeCount(playerIds, unreadCount);
        } else {
          this.logger.warn(`[FETCH_NOTIFICATIONS] No active devices found for user ${req?.user?.id}`);
        }
      } else {
        this.logger.log(`[FETCH_NOTIFICATIONS] No unread notifications, skipping badge update for user ${req?.user?.id}`);
      }

      res.status(HttpStatus.OK).json({
        message: 'Notifications Fetched Successfully',
        data: response,
        unread_count: unreadCount
      });
    } catch (error) {
      this.logger.error(`[FETCH_NOTIFICATIONS] Error fetching notifications: ${error.message}`);
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
      this.logger.log(`[MARK_READ] Received request to mark notification ${id} as read for user ${req?.user?.id}`);
      
      await this.notificationService.markNotificationAsRead(id, req?.user?.id);
      
      res.status(HttpStatus.OK).json({ 
        message: 'Notification marked as read successfully',
        data: { id }
      });
    } catch (error) {
      this.logger.error(`[MARK_READ] Error marking notification as read: ${error.message}`);
      throw error;
    }
  }

  @Patch('mark-all-read')
  async markAllAsRead(
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      this.logger.log(`[MARK_ALL_READ] Received request to mark all notifications as read for user ${req?.user?.id}`);
      
      await this.notificationService.markAllNotificationsAsRead(req?.user?.id);
      
      res.status(HttpStatus.OK).json({ 
        message: 'All notifications marked as read successfully'
      });
    } catch (error) {
      this.logger.error(`[MARK_ALL_READ] Error marking all notifications as read: ${error.message}`);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async deleteNotification(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.notificationService.deleteNotification(id, req?.user?.id);
      res.status(HttpStatus.OK).json({
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      this.logger.error(`Error deleting notification: ${error.message}`);
      throw error;
    }
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all notifications for the current user' })
  async deleteAllNotifications(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.notificationService.deleteAllNotifications(req?.user?.id);
      res.status(HttpStatus.OK).json({
        message: 'All notifications deleted successfully',
      });
    } catch (error) {
      this.logger.error(`Error deleting all notifications: ${error.message}`);
      throw error;
    }
  }
}
