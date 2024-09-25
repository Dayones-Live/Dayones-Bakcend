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
import { JwtGuard } from 'src/modules/Auth/guards/aws.cognito.guard';
import { UserUpdateInput } from '../dto/types';
import { Response } from 'express';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtGuard)
  @Post('update-user')
  async userSignUp(
    @Body()
    body: UserUpdateInput,
    @Res() res: Response,
  ) {
    try {
      const response = await this.userService.updateUser(body);
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'User successfully Update', data: response });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }
}
