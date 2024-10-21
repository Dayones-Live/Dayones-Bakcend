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
import { CreateUserSignatureInput } from '../dto/types';

@ApiTags('signature')
@Controller('signature')
@UseGuards(CognitoGuard)
export class SignatureController {
  constructor(
    private signatureService: SignatureService,
    private userService: UserService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @Role(Roles.ARTIST)
  async uploadUserSignature(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      if (!file) {
        throw new HttpException(
          `Missing required fields: file`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const buffer = file.buffer;
      const uploadUrl = await this.signatureService.saveUserSignature(
        req?.user?.id || '',
        buffer,
        file?.originalname,
        file?.originalname,
      );
      res.status(HttpStatus.CREATED).json({
        message: 'Signature Background Removed Successfully',
        data: uploadUrl,
      });
    } catch (error) {
      console.error(
        '🚀 ~ SignatureController ~ uploadSignature ~ error:',
        error,
      );
      throw error;
    }
  }

  @Post('create')
  @Role(Roles.ARTIST)
  async createUserSignature(
    @Body() createUserSignatureInput: CreateUserSignatureInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.signatureService.createSignature(
        req?.user?.id || '',
        createUserSignatureInput?.url,
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

  @Post('upload/file')
  @UseInterceptors(FileInterceptor('file'))
  @Role(Roles.ARTIST)
  async uploadSignatureToSignUrl(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { signedUrl: string },
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      if (!file) {
        throw new HttpException(
          `Missing required fields: file`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const { signedUrl } = body;
      // Perform the upload to the signed URL using fetch
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file.buffer, // Send the file buffer
        headers: {
          'Content-Type': file.mimetype, // Ensure the correct MIME type
        },
      });
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
}
