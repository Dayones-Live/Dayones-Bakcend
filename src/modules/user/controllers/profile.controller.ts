import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ProfileService } from '../services/profile.service';
import { CognitoGuard } from '../../auth/guards/aws.cognito.guard';
import {
  ProfileUpdateInput,
  GalleryImageInput,
  GalleryImageUpdateInput,
  GetUserProfileInput,
} from '../dto/profile.types';
import { SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @UseGuards(CognitoGuard)
  @Post('update')
  async updateProfile(
    @Body() profileUpdateInput: ProfileUpdateInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.profileService.updateProfile(
        req?.user?.id || '',
        profileUpdateInput,
      );
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ updateProfile ~ error:', error);
      throw error;
    }
  }

  @Public()
  @Get(':userId')
  async getUserProfile(
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    try {
      const response = await this.profileService.getUserProfile({ userId });
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ getUserProfile ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Post('gallery/add')
  async addGalleryImage(
    @Body() galleryImageInput: GalleryImageInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.profileService.addGalleryImage(
        req?.user?.id || '',
        galleryImageInput,
      );
      res.status(HttpStatus.CREATED).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ addGalleryImage ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Put('gallery/:imageId')
  async updateGalleryImage(
    @Param('imageId') imageId: string,
    @Body() galleryImageUpdateInput: GalleryImageUpdateInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.profileService.updateGalleryImage(
        req?.user?.id || '',
        imageId,
        galleryImageUpdateInput,
      );
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ updateGalleryImage ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Delete('gallery/:imageId')
  async deleteGalleryImage(
    @Param('imageId') imageId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.profileService.deleteGalleryImage(
        req?.user?.id || '',
        imageId,
      );
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ deleteGalleryImage ~ error:', error);
      throw error;
    }
  }

  @Public()
  @Get('gallery/:userId')
  async getUserGallery(
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    try {
      const response = await this.profileService.getUserGallery(userId);
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ ProfileController ~ getUserGallery ~ error:', error);
      throw error;
    }
  }
} 