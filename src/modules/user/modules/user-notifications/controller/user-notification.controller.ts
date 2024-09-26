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
import { CognitoGuard } from 'src/modules/auth/guards/aws.cognito.guard';
import { UserNotificationService } from '../services/user-notification.service';
import { UpsertUserNotificationInput } from '../dto/types';
import { UserService } from 'src/modules/user/services/user.service';

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
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response =
        await this.userNotificationService.upsertUserNotification({
          ...upsertUserNotificationInput,
          user_id,
        });
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'User is update successfully', data: response });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }
}
