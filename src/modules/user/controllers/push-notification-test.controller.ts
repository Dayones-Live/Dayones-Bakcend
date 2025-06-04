import { Controller, Post, Body, UseGuards, Req, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { UserService } from '@app/modules/user/services/user.service';

@Controller('push-notification-test')
@UseGuards(CognitoGuard)
export class PushNotificationTestController {
  private readonly logger = new Logger(PushNotificationTestController.name);

  constructor(
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
    private userService: UserService,
  ) {}

  @Post('send-test')
  async sendTestNotification(
    @Req() req: any,
    @Body() body: { title?: string; message?: string; targetUserId?: string }
  ) {
    try {
      // Get the target user ID (either the requesting user or a specified user)
      const targetUserId = body.targetUserId || req.user.id;
      this.logger.log(`Target user ID: ${targetUserId}`);
      
      // Check if the user exists by user_sub
      const user = await this.userService.findUserByUserSub(targetUserId);
      this.logger.log(`User found: ${JSON.stringify(user)}`);
      
      // Get active device IDs for the target user
      const playerIds = await this.userDeviceService.getActivePlayerIds(user.id);
      this.logger.log(`Active player IDs: ${JSON.stringify(playerIds)}`);
      
      if (playerIds.length === 0) {
        throw new HttpException(
          'No active devices found for the user',
          HttpStatus.BAD_REQUEST
        );
      }

      // Send test notification
      await this.pushNotificationService.sendPushNotification(
        playerIds,
        body.title || 'Test Notification',
        body.message || 'This is a test push notification',
        {
          type: 'TEST',
          timestamp: new Date().toISOString(),
          test: true
        }
      );

      return {
        success: true,
        message: 'Test notification sent successfully',
        details: {
          targetUserId: user.id,
          deviceCount: playerIds.length,
          playerIds
        }
      };
    } catch (error) {
      this.logger.error('Error sending test notification:', error);
      throw new HttpException(
        error.message || 'Failed to send test notification',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 