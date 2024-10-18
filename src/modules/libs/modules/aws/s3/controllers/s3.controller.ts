import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { PresignedUrlInput } from '@app/modules/libs/modules/aws/s3/dto/types';
import { S3Service } from '@app/modules/libs/modules/aws/s3/services/s3.service';
import {
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Controller,
  Post,
  Body,
} from '@nestjs/common';

@ApiTags('S3')
@Controller('s3')
@UseGuards(CognitoGuard)
export class S3Controller {
  constructor(private s3Service: S3Service) {}

  @Post()
  async createPresignedUrl(
    @Body() presignedUrlInput: PresignedUrlInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const userId = req?.user?.id;

      const s3Key = `${userId}/${presignedUrlInput?.path}`;
      const mimeType = presignedUrlInput?.fileMimeType;

      const signedUrl = await this.s3Service.getSignedUrl(
        s3Key,
        mimeType,
        presignedUrlInput.isUpload,
      );
      const unsignedUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.SIGNED_URL_SUCCESS,
        data: {
          signedUrl,
          url: unsignedUrl,
        },
      });
    } catch (error) {
      console.error('🚀 ~ S3Controller ~ S3SignedUrlCreate ~ error:', error);
      throw error;
    }
  }
}
