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
    const startTime = Date.now();
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Starting notification send`);
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Notification ID: ${notification.id}`);
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Notification Type: ${notification.type}`);
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Title: ${notification.title}`);
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Message: ${notification.message}`);
    this.logger.log(`[ONESIGNAL_NOTIFICATION] Target devices: ${playerIds.length}`);
    
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('[ONESIGNAL_NOTIFICATION] OneSignal credentials not configured');
        this.logger.error('[ONESIGNAL_NOTIFICATION] ONESIGNAL_APP_ID:', this.appId ? '***' : 'undefined');
        this.logger.error('[ONESIGNAL_NOTIFICATION] ONESIGNAL_REST_API_KEY:', this.restApiKey ? '***' : 'undefined');
        throw new Error('OneSignal credentials not configured');
      }

      this.logger.debug(`[ONESIGNAL_NOTIFICATION] Player IDs: ${JSON.stringify(playerIds)}`);

      if (playerIds.length === 0) {
        this.logger.warn('[ONESIGNAL_NOTIFICATION] No active devices found for user. Skipping OneSignal notification.');
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
        delivery_time_of_day: 'now',
        delayed_option: 'now',
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

      this.logger.log('[ONESIGNAL_NOTIFICATION] Sending request to OneSignal API...');
      this.logger.debug('[ONESIGNAL_NOTIFICATION] Request payload:', JSON.stringify(payload, null, 2));

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
      this.logger.log(`[ONESIGNAL_NOTIFICATION] OneSignal API responded in ${apiDuration}ms`);
      this.logger.log('[ONESIGNAL_NOTIFICATION] Notification sent successfully to OneSignal');
      this.logger.debug('[ONESIGNAL_NOTIFICATION] OneSignal API response:', JSON.stringify(response.data, null, 2));
      
      const totalDuration = Date.now() - startTime;
      this.logger.log(`[ONESIGNAL_NOTIFICATION] Notification send completed in ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[ONESIGNAL_NOTIFICATION] Error sending notification to OneSignal after ${totalDuration}ms: ${error.message}`);
      this.logger.error(`[ONESIGNAL_NOTIFICATION] Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error('[ONESIGNAL_NOTIFICATION] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error(`[ONESIGNAL_NOTIFICATION] HTTP status code: ${error.response.status}`);
        this.logger.error('[ONESIGNAL_NOTIFICATION] HTTP response headers:', JSON.stringify(error.response.headers, null, 2));
      }
      throw error;
    }
  }

  async sendNotificationToAll(
    notification: Notifications,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log('[ONESIGNAL_BROADCAST] Starting broadcast notification to all users');
    this.logger.log(`[ONESIGNAL_BROADCAST] Notification ID: ${notification.id}`);
    this.logger.log(`[ONESIGNAL_BROADCAST] Notification Type: ${notification.type}`);
    this.logger.log(`[ONESIGNAL_BROADCAST] Title: ${notification.title}`);
    this.logger.log(`[ONESIGNAL_BROADCAST] Message: ${notification.message}`);
    
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('[ONESIGNAL_BROADCAST] OneSignal credentials not configured');
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

      this.logger.debug('[ONESIGNAL_BROADCAST] Request payload:', JSON.stringify(payload, null, 2));

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
      const totalDuration = Date.now() - startTime;
      this.logger.log(`[ONESIGNAL_BROADCAST] OneSignal API responded in ${apiDuration}ms`);
      this.logger.log('[ONESIGNAL_BROADCAST] Broadcast notification sent successfully');
      this.logger.debug('[ONESIGNAL_BROADCAST] OneSignal API response:', JSON.stringify(response.data, null, 2));
      this.logger.log(`[ONESIGNAL_BROADCAST] Broadcast completed in ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[ONESIGNAL_BROADCAST] Error sending broadcast notification after ${totalDuration}ms: ${error.message}`);
      this.logger.error(`[ONESIGNAL_BROADCAST] Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error('[ONESIGNAL_BROADCAST] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error(`[ONESIGNAL_BROADCAST] HTTP status code: ${error.response.status}`);
        this.logger.error('[ONESIGNAL_BROADCAST] HTTP response headers:', JSON.stringify(error.response.headers, null, 2));
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
    const startTime = Date.now();
    this.logger.log(`[BADGE_UPDATE] Starting badge count update for ${playerIds.length} players`);
    this.logger.log(`[BADGE_UPDATE] Badge count: ${count}`);
    
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('[BADGE_UPDATE] OneSignal credentials not configured');
        throw new Error('OneSignal credentials not configured');
      }

      // Update each player's badge count individually
      for (const playerId of playerIds) {
        const playerStartTime = Date.now();
        this.logger.log(`[BADGE_UPDATE] Updating badge for player ${playerId}`);
        
        const payload = {
          app_id: this.appId,
          badge: count
        };

        this.logger.debug(`[BADGE_UPDATE] Request payload for player ${playerId}:`, JSON.stringify(payload, null, 2));

        const apiStartTime = Date.now();
        const response = await axios.put(
          `https://onesignal.com/api/v1/players/${playerId}`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${this.restApiKey}`,
            },
          },
        );

        const apiDuration = Date.now() - apiStartTime;
        const playerDuration = Date.now() - playerStartTime;
        this.logger.log(`[BADGE_UPDATE] Badge updated for player ${playerId} in ${playerDuration}ms (API: ${apiDuration}ms)`);
        this.logger.debug(`[BADGE_UPDATE] OneSignal API response for player ${playerId}:`, JSON.stringify(response.data, null, 2));
      }
      
      const totalDuration = Date.now() - startTime;
      this.logger.log(`[BADGE_UPDATE] Badge count update completed for all ${playerIds.length} players in ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[BADGE_UPDATE] Error updating badge count after ${totalDuration}ms: ${error.message}`);
      this.logger.error(`[BADGE_UPDATE] Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error('[BADGE_UPDATE] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error(`[BADGE_UPDATE] HTTP status code: ${error.response.status}`);
        this.logger.error('[BADGE_UPDATE] HTTP response headers:', JSON.stringify(error.response.headers, null, 2));
      }
      throw error;
    }
  }

  private async resetBadgeCount(playerIds: string[]): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`[BADGE_RESET] Starting badge reset for ${playerIds.length} players`);
    
    try {
      if (!this.appId || !this.restApiKey) {
        this.logger.error('[BADGE_RESET] OneSignal credentials not configured');
        throw new Error('OneSignal credentials not configured');
      }

      // Reset badge count for each player individually
      for (const playerId of playerIds) {
        const playerStartTime = Date.now();
        this.logger.log(`[BADGE_RESET] Resetting badge for player ${playerId}`);
        
        const payload = {
          app_id: this.appId,
          badge: 0
        };

        this.logger.debug(`[BADGE_RESET] Request payload for player ${playerId}:`, JSON.stringify(payload, null, 2));

        const apiStartTime = Date.now();
        const response = await axios.put(
          `https://onesignal.com/api/v1/players/${playerId}`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${this.restApiKey}`,
            },
          },
        );

        const apiDuration = Date.now() - apiStartTime;
        const playerDuration = Date.now() - playerStartTime;
        this.logger.log(`[BADGE_RESET] Badge reset for player ${playerId} in ${playerDuration}ms (API: ${apiDuration}ms)`);
        this.logger.debug(`[BADGE_RESET] OneSignal API response for player ${playerId}:`, JSON.stringify(response.data, null, 2));
      }
      
      const totalDuration = Date.now() - startTime;
      this.logger.log(`[BADGE_RESET] Badge reset completed for all ${playerIds.length} players in ${totalDuration}ms`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[BADGE_RESET] Error resetting badge count after ${totalDuration}ms: ${error.message}`);
      this.logger.error(`[BADGE_RESET] Stack trace: ${error.stack}`);
      
      if (error.response) {
        this.logger.error('[BADGE_RESET] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
        this.logger.error(`[BADGE_RESET] HTTP status code: ${error.response.status}`);
        this.logger.error('[BADGE_RESET] HTTP response headers:', JSON.stringify(error.response.headers, null, 2));
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

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      this.logger.log(`[DELETE] Attempting to delete notification ${notificationId} for user ${userId}`);
      
      // Find the notification
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, to_id: userId },
      });

      if (!notification) {
        this.logger.warn(`[DELETE] Notification ${notificationId} not found for user ${userId}`);
        throw new Error('Notification not found');
      }

      // Delete from local database
      await this.notificationsRepository.remove(notification);
      this.logger.log(`[DELETE] Successfully deleted notification ${notificationId} from database`);

      // Get active OneSignal player IDs for the user
      const playerIds = await this.getActivePlayerIds(userId);
      
      if (playerIds.length > 0) {
        // Get unread count for badge update
        const unreadCount = await this.notificationsRepository.count({
          where: { to_id: userId, is_read: false },
        });

        // Update badge count
        await this.updateBadgeCount(playerIds, unreadCount);
        this.logger.log(`[DELETE] Updated badge count to ${unreadCount} for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`[DELETE] Error deleting notification: ${error.message}`);
      if (error.response) {
        this.logger.error('[DELETE] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      this.logger.log(`[DELETE_ALL] Attempting to delete all notifications for user ${userId}`);
      
      // Delete all notifications from local database
      await this.notificationsRepository.delete({ to_id: userId });
      this.logger.log(`[DELETE_ALL] Successfully deleted all notifications from database for user ${userId}`);

      // Get active OneSignal player IDs for the user
      const playerIds = await this.getActivePlayerIds(userId);
      
      if (playerIds.length > 0) {
        // Reset badge count to 0
        await this.resetBadgeCount(playerIds);
        this.logger.log(`[DELETE_ALL] Reset badge count for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`[DELETE_ALL] Error deleting all notifications: ${error.message}`);
      if (error.response) {
        this.logger.error('[DELETE_ALL] OneSignal API error response:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
} 