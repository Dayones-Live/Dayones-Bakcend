import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../entities/user-device.entity';

@Injectable()
export class UserDeviceService {
  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
  ) {}

  async registerDevice(
    userId: string,
    oneSignalPlayerId: string,
    deviceType: string,
    deviceToken?: string,
  ): Promise<UserDevice> {
    // Check if device already exists
    const existingDevice = await this.userDeviceRepository.findOne({
      where: {
        userId,
        oneSignalPlayerId,
      },
    });

    if (existingDevice) {
      // Update existing device
      existingDevice.isActive = true;
      existingDevice.deviceToken = deviceToken;
      existingDevice.updatedAt = new Date();
      return this.userDeviceRepository.save(existingDevice);
    }

    // Create new device
    const device = new UserDevice();
    device.userId = userId;
    device.oneSignalPlayerId = oneSignalPlayerId;
    device.deviceType = deviceType;
    device.deviceToken = deviceToken;
    device.isActive = true;

    return this.userDeviceRepository.save(device);
  }

  async unregisterDevice(userId: string, oneSignalPlayerId: string): Promise<void> {
    await this.userDeviceRepository.update(
      {
        userId,
        oneSignalPlayerId,
      },
      {
        isActive: false,
        updatedAt: new Date(),
      },
    );
  }

  async getActivePlayerIds(userId: string): Promise<string[]> {
    const devices = await this.userDeviceRepository.find({
      where: {
        userId,
        isActive: true,
      },
      select: ['oneSignalPlayerId'],
    });

    return devices.map(device => device.oneSignalPlayerId);
  }

  async deactivateAllDevices(userId: string): Promise<void> {
    await this.userDeviceRepository.update(
      {
        userId,
        isActive: true,
      },
      {
        isActive: false,
        updatedAt: new Date(),
      },
    );
  }
} 