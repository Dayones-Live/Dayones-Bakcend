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
import { FirebaseService } from '../services/notification.service';

@Controller('notifications')
@UseGuards(CognitoGuard)
export class NotificationsController {
  constructor(private firebaseService: FirebaseService) {}

  @Get()
  async getAllUserNotification(@Res() res: Response, @Req() req: Request) {
    try {
      const response = await this.firebaseService.getAllNotification(
        req?.user?.id || '',
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
      const response = await this.firebaseService.markAsReadNotification(
        id,
        req?.user?.id || '',
      );
      res
        .status(HttpStatus.OK)
        .json({ message: 'Notification Update Successfully', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ NotificationsController ~ updateIsRead ~ error:',
        error,
      );
      throw error;
    }
  }
}
