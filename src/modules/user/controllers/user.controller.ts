import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { CognitoGuard } from 'src/modules/auth/guards/aws.cognito.guard';
import { UserUpdateInput } from '../dto/types';
import { Response } from 'express';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(CognitoGuard)
  @Post('update-user')
  async userSignUp(
    @Body()
    userUpdateInput: UserUpdateInput,
    @Res() res: Response,
  ) {
    try {
      const response = await this.userService.updateUser(userUpdateInput);
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'User is update successfully', data: response });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }
}
