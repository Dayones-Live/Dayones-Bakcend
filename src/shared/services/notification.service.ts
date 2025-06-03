import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly oneSignalAppId: string;
  private readonly oneSignalRestApiKey: string;
  private readonly oneSignalApiUrl = 'https://onesignal.com/api/v1';

  constructor(
    private configService: ConfigService,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
  ) {
    this.oneSignalAppId = this.configService.get<string>('ONESIGNAL_APP_ID');
    this.oneSignalRestApiKey = this.configService.get<string>('ONESIGNAL_REST_API_KEY');
    this.logger.log(`OneSignal App ID: ${this.oneSignalAppId ? 'Configured' : 'Not Configured'}`);
    this.logger.log(`OneSignal REST API Key: ${this.oneSignalRestApiKey ? 'Configured' : 'Not Configured'}`);
  }

  async sendNotification(
    notification: Notifications,
    playerIds: string[],
  ): Promise<void> {
    try {
      if (!this.oneSignalAppId || !this.oneSignalRestApiKey) {
        this.logger.error('OneSignal credentials are not properly configured');
        return;
      }

      this.logger.log(`Sending notification to ${playerIds.length} devices`);
      this.logger.log(`Player IDs: ${JSON.stringify(playerIds)}`);

      const notificationPayload = {
        app_id: this.oneSignalAppId,
        include_player_ids: playerIds,
        headings: { en: notification.title },
        contents: { en: notification.message },
        data: {
          ...JSON.parse(notification.data || '{}'),
          notificationId: notification.id,
          type: notification.type,
        },
      };

      this.logger.log('OneSignal notification payload:', JSON.stringify(notificationPayload, null, 2));

      const response = await axios.post(
        `${this.oneSignalApiUrl}/notifications`,
        notificationPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${this.oneSignalRestApiKey}`,
          },
        },
      );

      this.logger.log('OneSignal API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      this.logger.error('Failed to send OneSignal notification:', error);
      if (error.response) {
        this.logger.error('OneSignal API Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async sendNotificationToAll(
    notification: Notifications,
  ): Promise<void> {
    try {
      if (!this.oneSignalAppId || !this.oneSignalRestApiKey) {
        this.logger.error('OneSignal credentials are not properly configured');
        return;
      }

      this.logger.log('Sending notification to all users');

      const notificationPayload = {
        app_id: this.oneSignalAppId,
        included_segments: ['All'],
        headings: { en: notification.title },
        contents: { en: notification.message },
        data: {
          ...JSON.parse(notification.data || '{}'),
          notificationId: notification.id,
          type: notification.type,
        },
      };

      this.logger.log('OneSignal notification payload:', JSON.stringify(notificationPayload, null, 2));

      const response = await axios.post(
        `${this.oneSignalApiUrl}/notifications`,
        notificationPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${this.oneSignalRestApiKey}`,
          },
        },
      );

      this.logger.log('OneSignal API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      this.logger.error('Failed to send OneSignal notification to all users:', error);
      if (error.response) {
        this.logger.error('OneSignal API Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
} 