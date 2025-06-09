import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly appId: string;
  private readonly restApiKey: string;

  constructor(
    private configService: ConfigService,
    private userDeviceService: UserDeviceService,
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
        badge_type: 'Increase'
      };

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
            await this.userDeviceService.unregisterDevice(null, invalidPlayerId);
            this.logger.log(`Deactivated invalid device with player ID: ${invalidPlayerId}`);
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