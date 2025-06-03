import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly appId: string;
  private readonly restApiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
  ) {
    this.appId = this.configService.get<string>('ONESIGNAL_APP_ID');
    this.restApiKey = this.configService.get<string>('ONESIGNAL_REST_API_KEY');
    
    if (!this.appId || !this.restApiKey) {
      this.logger.error('OneSignal credentials not configured properly');
      this.logger.error('ONESIGNAL_APP_ID:', this.appId);
      this.logger.error('ONESIGNAL_REST_API_KEY:', this.restApiKey ? '***' : 'undefined');
    } else {
      this.logger.log('OneSignal credentials configured successfully');
    }
  }

  async sendNotification(
    notification: Notifications,
    playerIds: string[],
  ): Promise<void> {
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('OneSignal credentials not configured');
        this.logger.error('ONESIGNAL_APP_ID:', this.appId ? '***' : 'undefined');
        this.logger.error('ONESIGNAL_REST_API_KEY:', this.restApiKey ? '***' : 'undefined');
        throw new Error('OneSignal credentials not configured');
      }

      this.logger.log(`Sending notification to ${playerIds.length} devices`);
      this.logger.log('Player IDs:', playerIds);

      const payload = {
        app_id: this.appId,
        include_player_ids: playerIds,
        contents: {
          en: notification.message,
        },
        headings: {
          en: notification.title,
        },
        data: {
          ...JSON.parse(notification.data),
          notification_id: notification.id,
          type: notification.type,
        },
      };

      this.logger.log('OneSignal API payload:', JSON.stringify(payload, null, 2));
      this.logger.log('Sending request to OneSignal API...');

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

      this.logger.log('OneSignal API response:', JSON.stringify(response.data, null, 2));
      this.logger.log('Notification sent successfully to OneSignal');
    } catch (error) {
      this.logger.error('Error sending notification to OneSignal:', error.message);
      if (error.response) {
        this.logger.error('OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error('OneSignal API error status:', error.response.status);
        this.logger.error('OneSignal API error headers:', JSON.stringify(error.response.headers, null, 2));
      }
      throw error;
    }
  }

  async sendNotificationToAll(
    notification: Notifications,
  ): Promise<void> {
    try {
      if (!this.appId || !this.restApiKey) {
        throw new Error('OneSignal credentials not configured');
      }

      const payload = {
        app_id: this.appId,
        included_segments: ['All'],
        contents: {
          en: notification.message,
        },
        headings: {
          en: notification.title,
        },
        data: {
          ...JSON.parse(notification.data),
          notification_id: notification.id,
          type: notification.type,
        },
      };

      this.logger.log('Sending notification to all users');
      this.logger.log('OneSignal API payload:', JSON.stringify(payload, null, 2));

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

      this.logger.log('OneSignal API response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      this.logger.error('Error sending notification to all users:', error.message);
      if (error.response) {
        this.logger.error('OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
} 