import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../entities/user-device.entity';
import { In } from 'typeorm';

@Injectable()
export class UserDeviceService {
  private readonly logger = new Logger(UserDeviceService.name);

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
    const startTime = Date.now();
    this.logger.log(`[DEVICE_REGISTER] Starting device registration for user ${userId}`);
    this.logger.log(`[DEVICE_REGISTER] OneSignal Player ID: ${oneSignalPlayerId}`);
    this.logger.log(`[DEVICE_REGISTER] Device Type: ${deviceType}`);
    this.logger.debug(`[DEVICE_REGISTER] Device Token: ${deviceToken ? '***' : 'not provided'}`);
    
    try {
      // First, deactivate all other devices for this user
      this.logger.log(`[DEVICE_REGISTER] Deactivating all previous devices for user ${userId}`);
      const deactivateResult = await this.userDeviceRepository.update(
        { userId, isActive: true },
        { isActive: false, updatedAt: new Date() }
      );
      this.logger.log(`[DEVICE_REGISTER] Deactivated ${deactivateResult.affected || 0} previous devices`);
      
      // Check if device already exists
      this.logger.debug(`[DEVICE_REGISTER] Checking for existing device with Player ID: ${oneSignalPlayerId}`);
      const existingDevice = await this.userDeviceRepository.findOne({
        where: {
          userId,
          oneSignalPlayerId,
        },
      });

      if (existingDevice) {
        this.logger.log(`[DEVICE_REGISTER] Found existing device (ID: ${existingDevice.id}), reactivating...`);
        // Update existing device
        existingDevice.isActive = true;
        existingDevice.deviceToken = deviceToken;
        existingDevice.updatedAt = new Date();
        const updatedDevice = await this.userDeviceRepository.save(existingDevice);
        const duration = Date.now() - startTime;
        this.logger.log(`[DEVICE_REGISTER] Device reactivated successfully in ${duration}ms`);
        this.logger.debug(`[DEVICE_REGISTER] Device ID: ${updatedDevice.id}`);
        return updatedDevice;
      }

      this.logger.log(`[DEVICE_REGISTER] No existing device found, creating new device...`);
      // Create new device
      const device = new UserDevice();
      device.userId = userId;
      device.oneSignalPlayerId = oneSignalPlayerId;
      device.deviceType = deviceType;
      device.deviceToken = deviceToken;
      device.isActive = true;

      const savedDevice = await this.userDeviceRepository.save(device);
      const duration = Date.now() - startTime;
      this.logger.log(`[DEVICE_REGISTER] New device created successfully in ${duration}ms`);
      this.logger.debug(`[DEVICE_REGISTER] Device ID: ${savedDevice.id}`);
      return savedDevice;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DEVICE_REGISTER] Error registering device after ${duration}ms: ${error.message}`);
      this.logger.error(`[DEVICE_REGISTER] Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async unregisterDevice(userId: string, oneSignalPlayerId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[DEVICE_UNREGISTER] Starting device unregistration`);
    this.logger.log(`[DEVICE_UNREGISTER] User ID: ${userId}`);
    this.logger.log(`[DEVICE_UNREGISTER] OneSignal Player ID: ${oneSignalPlayerId}`);
    
    try {
      const updateResult = await this.userDeviceRepository.update(
        {
          userId,
          oneSignalPlayerId,
        },
        {
          isActive: false,
          updatedAt: new Date(),
        },
      );
      
      const duration = Date.now() - startTime;
      this.logger.log(`[DEVICE_UNREGISTER] Device unregistration completed in ${duration}ms`);
      this.logger.log(`[DEVICE_UNREGISTER] Affected devices: ${updateResult.affected || 0}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DEVICE_UNREGISTER] Error unregistering device after ${duration}ms: ${error.message}`);
      this.logger.error(`[DEVICE_UNREGISTER] Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async getActivePlayerIds(userId: string): Promise<string[]> {
    this.logger.debug(`[GET_ACTIVE_PLAYER_IDS] Fetching active player IDs for user ${userId}`);
    
    try {
      const devices = await this.userDeviceRepository.find({
        where: { userId, isActive: true },
        order: { updatedAt: 'DESC' }
      });
      
      this.logger.log(`[GET_ACTIVE_PLAYER_IDS] Found ${devices.length} active devices for user ${userId}`);
      
      // If multiple devices are found, deactivate all but the most recent one
      if (devices.length > 1) {
        const [mostRecent, ...olderDevices] = devices;
        this.logger.log(`[GET_ACTIVE_PLAYER_IDS] Multiple devices found, keeping most recent and deactivating ${olderDevices.length} older devices`);
        
        const updateResult = await this.userDeviceRepository.update(
          { id: In(olderDevices.map(d => d.id)) },
          { isActive: false, updatedAt: new Date() }
        );
        
        this.logger.log(`[GET_ACTIVE_PLAYER_IDS] Deactivated ${updateResult.affected || 0} older devices`);
        this.logger.debug(`[GET_ACTIVE_PLAYER_IDS] Active Player ID: ${mostRecent.oneSignalPlayerId}`);
        return [mostRecent.oneSignalPlayerId];
      }
      
      const playerIds = devices.map(device => device.oneSignalPlayerId);
      this.logger.debug(`[GET_ACTIVE_PLAYER_IDS] Returning ${playerIds.length} active player IDs`);
      return playerIds;
    } catch (error) {
      this.logger.error(`[GET_ACTIVE_PLAYER_IDS] Error fetching active player IDs: ${error.message}`);
      return [];
    }
  }

  async deactivateAllDevices(userId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[DEVICE_DEACTIVATE_ALL] Starting deactivation of all devices for user ${userId}`);
    
    try {
      const updateResult = await this.userDeviceRepository.update(
        {
          userId,
          isActive: true,
        },
        {
          isActive: false,
          updatedAt: new Date(),
        },
      );
      
      const duration = Date.now() - startTime;
      this.logger.log(`[DEVICE_DEACTIVATE_ALL] Deactivation completed in ${duration}ms`);
      this.logger.log(`[DEVICE_DEACTIVATE_ALL] Affected devices: ${updateResult.affected || 0}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DEVICE_DEACTIVATE_ALL] Error deactivating devices after ${duration}ms: ${error.message}`);
      this.logger.error(`[DEVICE_DEACTIVATE_ALL] Stack trace: ${error.stack}`);
      throw error;
    }
  }
} 