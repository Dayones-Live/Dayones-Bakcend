import {
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CognitoService } from '../services/cognito.service';
import { JwtGuard } from 'src/modules/Auth/guards/aws.cognito.guard';
import {
  ResendConfirmationCodeInput,
  SignInUserInput,
  UserConfirmationInput,
  UserSignUpInput,
} from '../dto/types';
import { Request, Response } from 'express';
import { Token } from 'src/modules/Auth/decorators/auth.decorator';

@ApiTags('auth')
@Controller('auth')
export class CognitoController {
  constructor(private cognitoService: CognitoService) {}

  @Post('signup')
  async userSignUp(
    @Body()
    body: UserSignUpInput,
    @Res() res: Response,
  ) {
    try {
      const response = await this.cognitoService.signUp(body);
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'User successfully signed up', data: response });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @Post('verify')
  async verifyUser(@Body() body: UserConfirmationInput, @Res() res: Response) {
    const { username, confirmationCode } = body;
    try {
      const result = await this.cognitoService.confirmSignUp(
        username,
        confirmationCode,
      );
      res
        .status(result.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ verifyUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  @Post('resend-confirm-email')
  async resendConfirmationCode(
    @Body() body: ResendConfirmationCodeInput,
    @Res() res: Response,
  ) {
    const { username } = body;
    try {
      const result = await this.cognitoService.resendSignUpCode(username);
      res
        .status(HttpStatus.OK)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error(
        '🚀 ~ CognitoController ~ resendConfirmationCode ~ error:',
        error,
      );
      throw error; // Handle the error appropriately
    }
  }

  @Post('signin')
  async signIn(@Body() body: SignInUserInput, @Res() res: Response) {
    const { username, password } = body;
    try {
      const result = await this.cognitoService.signIn({ username, password });
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ signIn ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  @UseGuards(JwtGuard)
  @Post('signout')
  async signout(@Token() token: string, @Res() res: Response) {
    try {
      const result = await this.cognitoService.signOut(token || '');
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ signout ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  @UseGuards(JwtGuard)
  @Post('me')
  async getCognitoUser(@Res() res: Response, @Req() req: Request) {
    try {
      const result = await this.cognitoService.getUser(req?.user_sub || '');
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }
}
