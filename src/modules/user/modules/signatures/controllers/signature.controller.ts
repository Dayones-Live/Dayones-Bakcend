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
import { CreateUserSignatureInput } from '../dto/types';
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

  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  @Role(Roles.ARTIST)
  async createUserSignature(
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
      const response = await this.signatureService.createSignature(
        {
          userId: req?.user?.id || '',
          url: '',
        },
        buffer,
        file.originalname,
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

  @Get('upload')
  @Role(Roles.ARTIST)
  async createSignatureWithUploadUrl(
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const userId = req?.user?.id || '';
      // Create a new record in the DB with an empty URL
      const signUrlResponse =
        await this.signatureService.generateUploadSignedUrl(userId);
      return res.status(HttpStatus.CREATED).json({
        message: 'Signed URL created successfully',
        data: {
          signedUrl: signUrlResponse.signedUrl,
          signatureId: signUrlResponse.signatureId,
        },
      });
    } catch (error) {
      console.error(
        'SignatureController ~ createSignatureWithUploadUrl ~ error:',
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
