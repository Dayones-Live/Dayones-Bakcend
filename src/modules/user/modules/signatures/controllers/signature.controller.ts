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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { SignatureService } from '../services/signature.service';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { UserService } from '@user/services/user.service';
import { Roles } from '@app/shared/constants/constants';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('signature')
@Controller('signature')
@UseGuards(CognitoGuard)
export class SignatureController {
  constructor(
    private signatureService: SignatureService,
    private userService: UserService,
  ) {}

  @Post()
  @Role(Roles.ARTIST)
  async createUserSignature(
    @Body() url: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.signatureService.createSignature(
        req?.user?.id || '',
        url,
      );
      res.status(HttpStatus.CREATED).json({
        message: 'User Signature creation successful',
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
  @Role(Roles.ARTIST)
  async getAllUserSignatures(@Res() res: Response, @Req() req: Request) {
    try {
      const response = await this.signatureService.fetchAllSignatures(
        req?.user?.id || '',
      );
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
  @Role(Roles.ARTIST)
  async deleteUserSignature(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.signatureService.deleteSignatureById(
        id,
        req?.user?.id || '',
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
