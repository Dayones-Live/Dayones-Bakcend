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
    try {
      if (!this.appId || !this.restApiKey) {
        throw new Error('OneSignal credentials not configured');
      }

      if (playerIds.length === 0) {
        this.logger.warn('No active devices found. Skipping push notification.');
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
        ios_interruption_level: 'time-sensitive',
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

      this.logger.log('Sending push notification with payload:', JSON.stringify(payload, null, 2));

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

      this.logger.log('Push notification sent successfully');
      this.logger.debug('OneSignal response:', response.data);

      // Handle invalid player IDs
      if (response.data?.errors?.invalid_player_ids?.length > 0) {
        const invalidPlayerIds = response.data.errors.invalid_player_ids;
        this.logger.warn(`Found ${invalidPlayerIds.length} invalid player IDs:`, invalidPlayerIds);
        
        // Deactivate invalid devices
        for (const invalidPlayerId of invalidPlayerIds) {
          try {
            // Find the device first to get the user ID
            const device = await this.userDeviceRepository.findOne({
              where: { oneSignalPlayerId: invalidPlayerId }
            });

            if (device) {
              await this.userDeviceService.unregisterDevice(device.userId, invalidPlayerId);
              this.logger.log(`Deactivated invalid device with player ID: ${invalidPlayerId} for user: ${device.userId}`);
            } else {
              this.logger.warn(`Could not find device with player ID: ${invalidPlayerId}`);
            }
          } catch (error) {
            this.logger.error(`Failed to deactivate invalid device ${invalidPlayerId}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error sending push notification:', error.message);
      if (error.response) {
        this.logger.error('OneSignal API error:', error.response.data);
      }
      throw error;
    }
  }
} 