import {
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
  HttpStatus,
  Req,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CognitoService } from '@libs/modules/aws/cognito/services/cognito.service';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import {
  ConfirmForgotPasswordInput,
  ForgotPasswordInput,
  ResendConfirmationCodeInput,
  SignInUserInput,
  UpdatePasswordInput,
  UserConfirmationInput,
  UserSignUpInput,
} from '@cognito/dto/types';
import { Token } from '@auth/decorators/auth.decorator';
import { Public } from '../decorators/public.decorator';
import { GlobalServiceResponse } from '@app/shared/types/types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private cognitoService: CognitoService) {}

  @Post('signup')
  @Public()
  async userSignUp(
    @Body()
    userSignUpInput: UserSignUpInput,
    @Res() res: Response,
  ) {
    try {
      const response = await this.cognitoService.signUp(userSignUpInput);
      res
        .status(response?.statusCode)
        .json({ message: response?.message, data: response?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @Post('verify')
  @Public()
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
  @Public()
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
  @Public()
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
      const result = await this.cognitoService.getUser(req?.user?.id || '');
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  /**
   * Controller to update the current password
   *
   * @param updatePasswordInput
   * @param res
   * @param req
   * @returns {GlobalServiceResponse}
   *
   * @throws Error if old password doesn't match
   */
  @UseGuards(CognitoGuard)
  @Post('update-password')
  async updatePassword(
    @Body() updatePasswordInput: UpdatePasswordInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.split(' ')[1]; // Extract token after 'Bearer'
      if (!token) {
        return res.status(400).json({ message: 'Bearer token is missing' });
      }
      updatePasswordInput.accessToken = token;
      const result =
        await this.cognitoService.updatePassword(updatePasswordInput);
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  /**
   * Controller to initiate the request for reset password with reset password verification code.
   *
   * @param forgotPasswordInput
   * @param res
   * @param req
   * @returns {GlobalServiceResponse}
   *
   * @throws Error if email sent failed with confirmation code
   */
  @UseGuards(CognitoGuard)
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPasswordInput: ForgotPasswordInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const result = await this.cognitoService.forgotPassword(
        forgotPasswordInput.userName,
      );
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  /**
   * Controller to confirm the password reset with new password using confirmation code
   *
   * @param confirmForgotPasswordInput
   * @param res
   * @param req
   * @returns {GlobalServiceResponse}
   *
   * @throws Error if confirmation code is incorrect and password policy don't satisfy
   */
  @UseGuards(CognitoGuard)
  @Post('confirm-forgot-password')
  async confirmForgotPassword(
    @Body() confirmForgotPasswordInput: ConfirmForgotPasswordInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const result = await this.cognitoService.confirmForgotPassword(
        confirmForgotPasswordInput,
      );
      res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ getCognitoUser ~ error:', error);
      throw error; // Handle the error appropriately
    }
  }

  @Public()
  @Post('google')
  @ApiOperation({ summary: 'Sign in with Google' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        idToken: { type: 'string', description: 'Google ID token' }
      },
      required: ['idToken']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully signed in with Google',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        data: { 
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            expires_in: { type: 'number' },
            refresh_token: { type: 'string' },
            token_type: { type: 'string' },
            user: { type: 'object' }
          }
        }
      }
    }
  })
  async signInWithGoogle(
    @Body() body: { idToken: string },
    @Res() res: Response,
  ) {
    try {
      // Log token info for debugging (safely - not the whole token)
      const tokenStart = body.idToken.substring(0, 10);
      const tokenEnd = body.idToken.substring(body.idToken.length - 10);
      console.log(`Received Google sign-in request with token: ${tokenStart}...${tokenEnd}`);
      console.log(`Token length: ${body.idToken.length} characters`);
      
      // Basic token format validation
      if (!body.idToken || body.idToken.split('.').length !== 3) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ 
            message: 'Invalid token format. Please try again with a valid Google ID token.', 
            error: true 
          });
      }
      
      const result = await this.cognitoService.signInWithGoogle(body.idToken);
      return res
        .status(result?.statusCode)
        .json({ message: result?.message, data: result?.data || '' });
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      // Log detailed error information for debugging
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        stack: error.stack
      });
      
      // For specific error cases, provide friendly messages
      if (error.message && error.message.includes('Attributes did not conform to the schema')) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ 
            message: 'Could not complete Google sign-in due to attribute requirements. Please contact support.', 
            details: error.message,
            error: true 
          });
      }
      
      // For unauthorized errors
      if (error.message && (
        error.message.includes('Invalid token') || 
        error.message.includes('expired') ||
        error.message.includes('Unauthorized')
      )) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ 
            message: 'Your Google sign-in session is invalid or expired. Please try again.', 
            error: true 
          });
      }
      
      // If it's an HttpException, use its status and message
      if (error instanceof HttpException) {
        return res
          .status(error.getStatus())
          .json({ 
            message: 'Google sign-in failed. Please try again.', 
            error: true 
          });
      }
      
      // Otherwise, return a 500 error
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ 
          message: 'Something went wrong with Google sign-in. Please try again later.', 
          error: true 
        });
    }
  }
}
