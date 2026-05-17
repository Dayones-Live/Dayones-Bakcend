import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../entities/user-device.entity';
import { UserNotification } from '../modules/user-notifications/entities/user-notifications.entity';
import { In } from 'typeorm';

@Injectable()
export class UserDeviceService {
  private readonly logger = new Logger(UserDeviceService.name);

  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(UserNotification)
    private userNotificationRepository: Repository<UserNotification>,
  ) {}

  async deactivateByFcmToken(fcmToken: string): Promise<void> {
    await this.userNotificationRepository.delete({
      notification_token: fcmToken,
    });
  }

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
    // NOTE: name is kept for back-compat with all callers, but this now
    // returns FCM tokens from the user-notifications table. The platform
    // ships push via FCM HTTP v1, not OneSignal.
    try {
      const rows = await this.userNotificationRepository.find({
        where: { user_id: userId },
      });
      const tokens = rows
        .map((r) => r.notification_token)
        .filter((t): t is string => !!t && t.length > 0);
      this.logger.debug(
        `[GET_ACTIVE_FCM_TOKENS] user=${userId} count=${tokens.length}`,
      );
      return tokens;
    } catch (error) {
      this.logger.error(
        `[GET_ACTIVE_FCM_TOKENS] Error: ${error.message}`,
      );
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