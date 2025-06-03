import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OneSignal from 'onesignal-node';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private oneSignalClient: OneSignal.Client;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
  ) {
    this.initializeOneSignal();
  }

  private initializeOneSignal() {
    try {
      const appId = this.configService.get<string>('ONESIGNAL_APP_ID');
      const restApiKey = this.configService.get<string>('ONESIGNAL_REST_API_KEY');

      if (!appId || !restApiKey) {
        this.logger.error('OneSignal credentials are not properly configured');
        return;
      }

      this.oneSignalClient = new OneSignal.Client(appId, restApiKey);
      this.logger.log('OneSignal client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OneSignal client:', error);
    }
  }

  async sendNotification(
    notification: Notifications,
    playerIds: string[],
  ): Promise<void> {
    try {
      if (!this.oneSignalClient) {
        this.logger.error('OneSignal client not initialized');
        return;
      }

      const notificationPayload = {
        headings: { en: notification.title },
        contents: { en: notification.message },
        include_player_ids: playerIds,
        data: {
          ...JSON.parse(notification.data || '{}'),
          notificationId: notification.id,
          type: notification.type,
        },
      };

      const response = await this.oneSignalClient.createNotification(notificationPayload);
      this.logger.log('OneSignal notification sent successfully:', response);
    } catch (error) {
      this.logger.error('Failed to send OneSignal notification:', error);
      throw error;
    }
  }

  async sendNotificationToAll(
    notification: Notifications,
  ): Promise<void> {
    try {
      if (!this.oneSignalClient) {
        this.logger.error('OneSignal client not initialized');
        return;
      }

      const notificationPayload = {
        headings: { en: notification.title },
        contents: { en: notification.message },
        included_segments: ['All'],
        data: {
          ...JSON.parse(notification.data || '{}'),
          notificationId: notification.id,
          type: notification.type,
        },
      };

      const response = await this.oneSignalClient.createNotification(notificationPayload);
      this.logger.log('OneSignal notification sent to all users successfully:', response);
    } catch (error) {
      this.logger.error('Failed to send OneSignal notification to all users:', error);
      throw error;
    }
  }
} 