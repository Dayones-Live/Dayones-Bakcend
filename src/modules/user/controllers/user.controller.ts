import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { UserService } from '../services/user.service';
import { CognitoGuard } from '../../auth/guards/aws.cognito.guard';
import { UpdateUserLocationInput, UserUpdateInput } from '../dto/types';
import { SUCCESS_MESSAGES } from '@app/shared/constants/constants';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(CognitoGuard)
  @Post('update-user')
  async updateUser(
    @Body()
    userUpdateInput: UserUpdateInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.userService.updateUser(
        userUpdateInput,
        req?.user?.id || '',
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_UPDATED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Post('update-location')
  async updateUserLocation(
    @Body()
    userLocationUpdateInput: UpdateUserLocationInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.userService.updateUserLocation(
        userLocationUpdateInput,
        req?.user?.id || '',
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_LOCATION_UPDATE_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }
}
