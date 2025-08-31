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
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { UserService } from '../services/user.service';
import { CognitoGuard } from '../../auth/guards/aws.cognito.guard';
import {
  UpdateUserLocationAndNotificationInput,
  UpdateUserLocationInput,
  UserUpdateInput,
  ApproveArtistInput,
  RejectArtistInput,
} from '../dto/types';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { GlobalServiceResponse } from '@app/shared/types/types';

@ApiTags('user')
@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private userService: UserService) {}

  @UseGuards(CognitoGuard)
  @Post('update-user')
  async updateUser(
    @Body()
    userUpdateInput: UserUpdateInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.userService.updateUser(
        userUpdateInput,
        req?.user?.id || '',
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_UPDATED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Post('update-location')
  async updateUserLocation(
    @Body()
    updateUserLocationInput: UpdateUserLocationInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const userId = req?.user?.id || '';
      this.logger.log(`🎯 [LOCATION_ENDPOINT] User ${userId} updating location to (${updateUserLocationInput.latitude}, ${updateUserLocationInput.longitude})`);
      
      const response = await this.userService.updateUserLocation(
        updateUserLocationInput,
        userId,
      );
      
      this.logger.log(`🎯 [LOCATION_ENDPOINT] ✅ User ${userId} location updated successfully`);
      
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_LOCATION_UPDATE_SUCCESS,
        data: response,
      });
    } catch (error) {
      const userId = req?.user?.id || '';
      this.logger.error(`🎯 [LOCATION_ENDPOINT] ❌ Error updating location for user ${userId}: ${error?.message}`);
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Post('update-location-and-notification')
  async updateUserLocationAndNotification(
    @Body()
    updateUserLocationAndNotificationInput: UpdateUserLocationAndNotificationInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const userId = req?.user?.id || '';
      this.logger.log(`🎯 [LOCATION_ENDPOINT] User ${userId} updating location and notification status`);
      this.logger.log(`🎯 [LOCATION_ENDPOINT] New location: (${updateUserLocationAndNotificationInput.latitude}, ${updateUserLocationAndNotificationInput.longitude})`);
      this.logger.log(`🎯 [LOCATION_ENDPOINT] Notifications enabled: ${updateUserLocationAndNotificationInput.notificationsEnabled}`);
      
      const response = await this.userService.updateNotificationStatusAndLocation(
        updateUserLocationAndNotificationInput,
        userId,
      );
      
      this.logger.log(`🎯 [LOCATION_ENDPOINT] ✅ User ${userId} location and notification status updated successfully`);
      
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_LOCATION_UPDATE_SUCCESS,
        data: response,
      });
    } catch (error) {
      const userId = req?.user?.id || '';
      this.logger.error(`🎯 [LOCATION_ENDPOINT] ❌ Error updating location and notification for user ${userId}: ${error?.message}`);
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  /**
   *  Service to soft delete the user
   *
   * @param res
   * @param req
   * @return {GlobalServiceResponse}
   *
   * @throws Error if User is already deleted or user doesn't exist
   */
  @UseGuards(CognitoGuard)
  @Post('delete-user')
  async deleteLoggedInUser(@Res() res: Response, @Req() req: Request) {
    try {
      const response = await this.userService.deleteCurrentLoggedInUser(
        req?.user?.id || '',
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_DELETE_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CognitoController ~ userSignUp ~ error:', error);
      throw error;
    }
  }

  // Admin endpoints for artist approval

  @Get('pending-artists')
  @Role(Roles.SUPER_ADMIN)
  @UseGuards(CognitoGuard)
  async getPendingArtists(@Res() res: Response, @Req() req: Request) {
    try {
      const pendingArtists = await this.userService.fetchPendingArtistApprovals();
      res.status(HttpStatus.OK).json({
        message: 'Pending artists fetched successfully',
        data: pendingArtists,
      });
    } catch (error) {
      console.error('🚀 ~ UserController ~ getPendingArtists ~ error:', error);
      throw error;
    }
  }

  @Post('approve-artist')
  @Role(Roles.SUPER_ADMIN)
  @UseGuards(CognitoGuard)
  async approveArtist(
    @Body() approveArtistInput: ApproveArtistInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.userService.approveArtist(
        approveArtistInput.userId,
        req?.user?.id || '',
      );
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ UserController ~ approveArtist ~ error:', error);
      throw error;
    }
  }

  @Post('reject-artist')
  @Role(Roles.SUPER_ADMIN)
  @UseGuards(CognitoGuard)
  async rejectArtist(
    @Body() rejectArtistInput: RejectArtistInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.userService.rejectArtist(
        rejectArtistInput.userId,
        req?.user?.id || '',
      );
      res.status(HttpStatus.OK).json({
        message: response.message,
        data: response.data,
      });
    } catch (error) {
      console.error('🚀 ~ UserController ~ rejectArtist ~ error:', error);
      throw error;
    }
  }
}
