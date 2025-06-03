import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { UserDeviceService } from '../services/user-device.service';
import { Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('devices')
@UseGuards(CognitoGuard)
export class UserDeviceController {
  constructor(private userDeviceService: UserDeviceService) {}

  @Post('register')
  async registerDevice(
    @Req() req: Request,
    @Body() body: { oneSignalPlayerId: string; deviceType: string; deviceToken?: string },
  ) {
    const userId = req.user.id;
    const { oneSignalPlayerId, deviceType, deviceToken } = body;

    const device = await this.userDeviceService.registerDevice(
      userId,
      oneSignalPlayerId,
      deviceType,
      deviceToken,
    );

    return {
      message: 'Device registered successfully',
      data: device,
    };
  }

  @Post('unregister')
  async unregisterDevice(
    @Req() req: Request,
    @Body() body: { oneSignalPlayerId: string },
  ) {
    const userId = req.user.id;
    const { oneSignalPlayerId } = body;

    await this.userDeviceService.unregisterDevice(userId, oneSignalPlayerId);

    return {
      message: 'Device unregistered successfully',
    };
  }
} 