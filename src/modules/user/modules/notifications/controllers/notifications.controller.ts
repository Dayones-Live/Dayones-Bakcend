import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
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

@Controller('notifications')
@UseGuards(CognitoGuard)
export class NotificationsController {
  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
  ) {}

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
