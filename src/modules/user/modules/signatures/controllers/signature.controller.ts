import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Response, Request } from 'express';
import { CognitoGuard } from 'src/modules/auth/guards/aws.cognito.guard';
import { UserService } from 'src/modules/user/services/user.service';
import { SignatureService } from '../services/signature.service';
import { CreateUserSignatureInput } from '../dto/types';

@ApiTags('signature')
@Controller('signature')
@UseGuards(CognitoGuard)
export class SignatureController {
  constructor(
    private signatureService: SignatureService,
    private userService: UserService,
  ) {}

  @Post('create')
  async createUserSignature(
    @Body() createUserSignatureInput: CreateUserSignatureInput,
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
      const response = await this.signatureService.createSignatureNotification({
        ...createUserSignatureInput,
        user_id,
      });
      res
        .status(HttpStatus.CREATED)
        .json({
          message: 'User Signature creation successfull',
          data: response,
        });
    } catch (error) {
      console.error(
        '🚀 ~ SignatureController ~ upsertUserSignature ~ error:',
        error,
      );
      throw error;
    }
  }

  @Get()
  async getAllUserSignatures(@Res() res: Response, @Req() req: Request) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response = await this.signatureService.fetchAllSignatures(user_id);
      res
        .status(HttpStatus.OK)
        .json({ message: 'Signatures Fetched Successfully', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ SignatureController ~ getAllUserSignatures ~ error:',
        error,
      );
      throw error;
    }
  }

  @Delete(':id')
  async deleteUserSignature(
    @Param('id') id: string,
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
      const response = await this.signatureService.deleteSignatureById(
        id,
        user_id,
      );
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Signature delete successful', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ SignatureController ~ upsertUserSignature ~ error:',
        error,
      );
      throw error;
    }
  }
}
