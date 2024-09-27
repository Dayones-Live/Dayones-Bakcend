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
import { CognitoService } from '../../libs/modules/aws/cognito/services/cognito.service';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import {
  ResendConfirmationCodeInput,
  SignInUserInput,
  UserConfirmationInput,
  UserSignUpInput,
} from '../../libs/modules/aws/cognito/dto/types';
import { Request, Response } from 'express';
import { Token } from '@auth/decorators/auth.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private cognitoService: CognitoService) {}

  @Post('signup')
  async userSignUp(
    @Body()
    userSignUpInput: UserSignUpInput,
    @Res() res: Response,
  ) {
    try {
      const response = await this.cognitoService.signUp(userSignUpInput);
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'User signed up successful', data: response });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @Post('verify')
  async verifyUser(
    @Body() userConfirmationInput: UserConfirmationInput,
    @Res() res: Response,
  ) {
    const { username, confirmationCode } = userConfirmationInput;
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
    @Body() resendConfirmationCodeInput: ResendConfirmationCodeInput,
    @Res() res: Response,
  ) {
    const { username } = resendConfirmationCodeInput;
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
  async signIn(@Body() signInUserInput: SignInUserInput, @Res() res: Response) {
    const { username, password } = signInUserInput;
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

  @UseGuards(CognitoGuard)
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

  @UseGuards(CognitoGuard)
  @Post('me')
  async getCognitoUser(@Res() res: Response, @Req() req: Request) {
    try {
      const result = await this.cognitoService.getUser(req?.userSub || '');
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }
}
