import { Body, Controller, Post, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { UserDeviceService } from '../services/user-device.service';
import { Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('devices')
@UseGuards(CognitoGuard)
export class UserDeviceController {
  private readonly logger = new Logger(UserDeviceController.name);

  constructor(private userDeviceService: UserDeviceService) {}

  @Post('register')
  async registerDevice(
    @Req() req: Request,
    @Body() body: { oneSignalPlayerId: string; deviceType: string; deviceToken?: string },
  ) {
    try {
      this.logger.log('Received device registration request');
      this.logger.debug('Request body:', body);
      
      if (!body.oneSignalPlayerId || !body.deviceType) {
        throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
      }

      const userId = req.user.id;
      this.logger.log(`Registering device for user: ${userId}`);

      const { oneSignalPlayerId, deviceType, deviceToken } = body;

      const device = await this.userDeviceService.registerDevice(
        userId,
        oneSignalPlayerId,
        deviceType,
        deviceToken,
      );

      this.logger.log('Device registered successfully');
      this.logger.debug('Registered device:', device);

      return {
        message: 'Device registered successfully',
        data: device,
      };
    } catch (error) {
      this.logger.error('Error registering device:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to register device',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('unregister')
  async unregisterDevice(
    @Req() req: Request,
    @Body() body: { oneSignalPlayerId: string },
  ) {
    try {
      this.logger.log('Received device unregistration request');
      this.logger.debug('Request body:', body);

      if (!body.oneSignalPlayerId) {
        throw new HttpException('Missing OneSignal player ID', HttpStatus.BAD_REQUEST);
      }

      const userId = req.user.id;
      this.logger.log(`Unregistering device for user: ${userId}`);

      await this.userDeviceService.unregisterDevice(userId, body.oneSignalPlayerId);

      this.logger.log('Device unregistered successfully');

      return {
        message: 'Device unregistered successfully',
      };
    } catch (error) {
      this.logger.error('Error unregistering device:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to unregister device',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 