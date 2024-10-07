import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { UserNotificationService } from '../services/user-notification.service';
import { UpsertUserNotificationInput } from '../dto/types';
import { UserService } from 'src/modules/user/services/user.service';
import { CognitoGuard } from 'src/modules/auth/guards/aws.cognito.guard';

@ApiTags('user-notification')
@Controller('user-notification')
export class UserNotificationController {
  constructor(
    private userNotificationService: UserNotificationService,
    private userService: UserService,
  ) {}

  @UseGuards(CognitoGuard)
  @Post('token')
  async upsertUserNotification(
    @Body()
    upsertUserNotificationInput: UpsertUserNotificationInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response =
        await this.userNotificationService.upsertUserNotification({
          ...upsertUserNotificationInput,
          userId: req?.user?.id || '',
        });
      res.status(HttpStatus.CREATED).json({
        message: 'User Notification is update successfully',
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }
}
