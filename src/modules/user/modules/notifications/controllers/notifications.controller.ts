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

@Controller('notifications')
@UseGuards(CognitoGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
    private notificationService: NotificationService,
    private userDeviceService: UserDeviceService,
  ) {}

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
        await this.notificationService.sendNotification(savedNotification, playerIds);
        res.status(HttpStatus.OK).json({
          message: 'Test notification sent successfully',
          data: this.notificationMapper.toDto(savedNotification),
        });
      } else {
        res.status(HttpStatus.OK).json({
          message: 'Test notification saved but no active devices found',
          data: this.notificationMapper.toDto(savedNotification),
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
      });
      
      const response = notifications.map(notification => 
        this.notificationMapper.toDto(notification)
      );

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
