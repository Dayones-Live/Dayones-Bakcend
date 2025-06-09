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
    console.log(`[UserDeviceService] Registering device for user ${userId}`);
    console.log(`[UserDeviceService] OneSignal Player ID: ${oneSignalPlayerId}`);
    console.log(`[UserDeviceService] Device Type: ${deviceType}`);
    
    // Check if device already exists
    const existingDevice = await this.userDeviceRepository.findOne({
      where: {
        userId,
        oneSignalPlayerId,
      },
    });

    if (existingDevice) {
      console.log(`[UserDeviceService] Found existing device, updating...`);
      // Update existing device
      existingDevice.isActive = true;
      existingDevice.deviceToken = deviceToken;
      existingDevice.updatedAt = new Date();
      const updatedDevice = await this.userDeviceRepository.save(existingDevice);
      console.log(`[UserDeviceService] Device updated successfully`);
      return updatedDevice;
    }

    console.log(`[UserDeviceService] Creating new device...`);
    // Create new device
    const device = new UserDevice();
    device.userId = userId;
    device.oneSignalPlayerId = oneSignalPlayerId;
    device.deviceType = deviceType;
    device.deviceToken = deviceToken;
    device.isActive = true;

    const savedDevice = await this.userDeviceRepository.save(device);
    console.log(`[UserDeviceService] New device created successfully`);
    return savedDevice;
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

    // Ensure unique player IDs
    const uniquePlayerIds = [...new Set(devices.map(device => device.oneSignalPlayerId))];
    
    // Log device information for debugging
    console.log(`[UserDeviceService] Found ${devices.length} active devices for user ${userId}`);
    console.log(`[UserDeviceService] Unique player IDs: ${uniquePlayerIds.join(', ')}`);
    
    return uniquePlayerIds;
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