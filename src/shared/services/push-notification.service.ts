import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@app/modules/user/entities/user-device.entity';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly appId: string;
  private readonly restApiKey: string;

  constructor(
    private configService: ConfigService,
    private userDeviceService: UserDeviceService,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
  ) {
    this.appId = this.configService.get<string>('ONESIGNAL_APP_ID');
    this.restApiKey = this.configService.get<string>('ONESIGNAL_REST_API_KEY');
    
    if (!this.appId || !this.restApiKey) {
      this.logger.error('OneSignal credentials not configured properly');
    } else {
      this.logger.log('OneSignal credentials configured successfully');
    }
  }

  async sendPushNotification(
    playerIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[ONESIGNAL_PUSH] Starting push notification`);
    this.logger.log(`[ONESIGNAL_PUSH] Title: ${title}`);
    this.logger.log(`[ONESIGNAL_PUSH] Message: ${message}`);
    this.logger.log(`[ONESIGNAL_PUSH] Target devices: ${playerIds.length}`);
    this.logger.debug(`[ONESIGNAL_PUSH] Player IDs: ${JSON.stringify(playerIds)}`);
    this.logger.debug(`[ONESIGNAL_PUSH] Custom data: ${JSON.stringify(data || {})}`);
    
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('[ONESIGNAL_PUSH] OneSignal credentials not configured');
        throw new Error('OneSignal credentials not configured');
      }

      if (playerIds.length === 0) {
        this.logger.warn('[ONESIGNAL_PUSH] No active devices found. Skipping push notification.');
        return;
      }

      const payload = {
        app_id: this.appId,
        include_player_ids: playerIds,
        contents: {
          en: message,
        },
        headings: {
          en: title,
        },
        data: data || {},
        badge: 1,
        badge_type: 'Increase',
        ios_badgeType: 'Increase',
        ios_badgeCount: 1,
        ios_sound: 'default',
        ios_attachments: {
          id1: 'https://dayones-test-bucket.s3.us-east-1.amazonaws.com/notification-icon.png'
        },
        ios_category: 'message',
        ios_mutable_content: true,
        ios_content_available: true,
        priority: 10,
        android_channel_id: undefined,
        android_sound: undefined,
        android_priority: undefined,
        android_visibility: undefined,
        android_led_color: undefined,
        android_accent_color: undefined,
        android_group: undefined,
        android_group_message: undefined
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      this.logger.log('[ONESIGNAL_PUSH] Sending request to OneSignal API...');
      this.logger.debug('[ONESIGNAL_PUSH] Request payload:', JSON.stringify(payload, null, 2));

      const apiStartTime = Date.now();
      const response = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${this.restApiKey}`,
          },
        },
      );

      const apiDuration = Date.now() - apiStartTime;
      this.logger.log(`[ONESIGNAL_PUSH] OneSignal API responded in ${apiDuration}ms`);
      this.logger.log('[ONESIGNAL_PUSH] Push notification sent successfully');
      this.logger.debug('[ONESIGNAL_PUSH] OneSignal API response:', JSON.stringify(response.data, null, 2));

      // Handle invalid player IDs
      if (response.data?.errors?.invalid_player_ids?.length > 0) {
        const invalidPlayerIds = response.data.errors.invalid_player_ids;
        this.logger.warn(`[ONESIGNAL_PUSH] Found ${invalidPlayerIds.length} invalid player IDs`);
        this.logger.debug(`[ONESIGNAL_PUSH] Invalid player IDs: ${JSON.stringify(invalidPlayerIds)}`);
        
        // Deactivate invalid devices
        for (const invalidPlayerId of invalidPlayerIds) {
          try {
            this.logger.log(`[ONESIGNAL_PUSH] Processing invalid player ID: ${invalidPlayerId}`);
            
            // Find the device first to get the user ID
            const device = await this.userDeviceRepository.findOne({
              where: { oneSignalPlayerId: invalidPlayerId }
            });

            if (device) {
              this.logger.log(`[ONESIGNAL_PUSH] Found device for invalid player ID, deactivating...`);
              await this.userDeviceService.unregisterDevice(device.userId, invalidPlayerId);
              this.logger.log(`[ONESIGNAL_PUSH] Successfully deactivated invalid device with player ID: ${invalidPlayerId} for user: ${device.userId}`);
            } else {
              this.logger.warn(`[ONESIGNAL_PUSH] Could not find device with player ID: ${invalidPlayerId}`);
            }
          } catch (error) {
            this.logger.error(`[ONESIGNAL_PUSH] Failed to deactivate invalid device ${invalidPlayerId}:`, error.message);
            this.logger.error(`[ONESIGNAL_PUSH] Stack trace: ${error.stack}`);
          }
        }
      }
      
      const totalDuration = Date.now() - startTime;
      this.logger.log(`[ONESIGNAL_PUSH] Push notification completed in ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[ONESIGNAL_PUSH] Error sending push notification after ${totalDuration}ms: ${error.message}`);
      this.logger.error(`[ONESIGNAL_PUSH] Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error('[ONESIGNAL_PUSH] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error(`[ONESIGNAL_PUSH] HTTP status code: ${error.response.status}`);
        this.logger.error('[ONESIGNAL_PUSH] HTTP response headers:', JSON.stringify(error.response.headers, null, 2));
      }
      
      throw error;
    }
  }
} 