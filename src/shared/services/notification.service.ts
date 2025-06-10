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

      if (playerIds.length === 0) {
        this.logger.warn('No active devices found for user. Skipping OneSignal notification.');
        return;
      }

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

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      this.logger.log(`[MARK_READ] Attempting to mark notification ${notificationId} as read for user ${userId}`);
      
      // Find the notification
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, to_id: userId },
      });

      if (!notification) {
        this.logger.warn(`[MARK_READ] Notification ${notificationId} not found for user ${userId}`);
        throw new Error('Notification not found');
      }

      if (notification.is_read) {
        this.logger.log(`[MARK_READ] Notification ${notificationId} is already marked as read`);
        return;
      }

      // Update notification in database
      notification.is_read = true;
      await this.notificationsRepository.save(notification);
      this.logger.log(`[MARK_READ] Successfully marked notification ${notificationId} as read in database`);

      // Get unread count for the user
      const unreadCount = await this.notificationsRepository.count({
        where: { to_id: userId, is_read: false },
      });
      this.logger.log(`[MARK_READ] User ${userId} has ${unreadCount} unread notifications`);

      // Get active OneSignal player IDs for the user
      const playerIds = await this.getActivePlayerIds(userId);
      
      if (playerIds.length > 0) {
        this.logger.log(`[MARK_READ] Updating badge count for user ${userId} with player IDs: ${playerIds.join(', ')}`);
        await this.updateBadgeCount(playerIds, unreadCount);
      } else {
        this.logger.warn(`[MARK_READ] No active devices found for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`[MARK_READ] Error marking notification as read: ${error.message}`);
      if (error.response) {
        this.logger.error('[MARK_READ] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      this.logger.log(`[MARK_ALL_READ] Attempting to mark all notifications as read for user ${userId}`);
      
      // Update all notifications in database
      await this.notificationsRepository.update(
        { to_id: userId, is_read: false },
        { is_read: true }
      );
      this.logger.log(`[MARK_ALL_READ] Successfully marked all notifications as read in database for user ${userId}`);

      // Get active OneSignal player IDs for the user
      const playerIds = await this.getActivePlayerIds(userId);
      
      if (playerIds.length > 0) {
        this.logger.log(`[MARK_ALL_READ] Resetting badge count for user ${userId} with player IDs: ${playerIds.join(', ')}`);
        await this.resetBadgeCount(playerIds);
      } else {
        this.logger.warn(`[MARK_ALL_READ] No active devices found for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`[MARK_ALL_READ] Error marking all notifications as read: ${error.message}`);
      if (error.response) {
        this.logger.error('[MARK_ALL_READ] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async updateBadgeCount(playerIds: string[], count: number): Promise<void> {
    try {
      if (!this.appId || !this.restApiKey) {
        throw new Error('OneSignal credentials not configured');
      }

      const payload = {
        app_id: this.appId,
        include_player_ids: playerIds,
        contents: {
          en: "Notification" // Required non-empty content
        },
        headings: {
          en: "Update" // Required non-empty heading
        },
        badge: count,
        badge_type: 'SetTo',
        android_visibility: 0, // Make notification invisible on Android
        ios_sound: "silent.wav" // Use silent sound for iOS
      };

      this.logger.log('[BADGE_UPDATE] OneSignal API payload:', JSON.stringify(payload, null, 2));

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

      this.logger.log('[BADGE_UPDATE] OneSignal API response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      this.logger.error('[BADGE_UPDATE] Error updating badge count:', error.message);
      if (error.response) {
        this.logger.error('[BADGE_UPDATE] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  private async resetBadgeCount(playerIds: string[]): Promise<void> {
    try {
      if (!this.appId || !this.restApiKey) {
        throw new Error('OneSignal credentials not configured');
      }

      const payload = {
        app_id: this.appId,
        include_player_ids: playerIds,
        contents: {
          en: "Notification" // Required non-empty content
        },
        headings: {
          en: "Update" // Required non-empty heading
        },
        badge: 0,
        badge_type: 'SetTo',
        android_visibility: 0, // Make notification invisible on Android
        ios_sound: "silent.wav" // Use silent sound for iOS
      };

      this.logger.log('[BADGE_RESET] OneSignal API payload:', JSON.stringify(payload, null, 2));

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

      this.logger.log('[BADGE_RESET] OneSignal API response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      this.logger.error('[BADGE_RESET] Error resetting badge count:', error.message);
      if (error.response) {
        this.logger.error('[BADGE_RESET] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      // Don't throw the error - we want to continue even if badge reset fails
      this.logger.warn('[BADGE_RESET] Continuing despite badge reset failure');
    }
  }

  private async getActivePlayerIds(userId: string): Promise<string[]> {
    try {
      const devices = await this.notificationsRepository.query(
        `SELECT one_signal_player_id FROM user_devices WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      return devices.map(device => device.one_signal_player_id);
    } catch (error) {
      this.logger.error(`[GET_PLAYER_IDS] Error getting active player IDs for user ${userId}:`, error.message);
      return [];
    }
  }
} 