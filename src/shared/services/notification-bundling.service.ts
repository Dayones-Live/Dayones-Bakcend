import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { NOTIFICATION_TYPE } from '@app/modules/user/modules/notifications/constants';
import { Roles } from '@app/shared/constants/constants';

type NotificationType = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

@Injectable()
export class NotificationBundlingService {
  private readonly logger = new Logger(NotificationBundlingService.name);
  private readonly BUNDLE_WINDOW_MINUTES = 15;
  private readonly MAX_INDIVIDUAL_NOTIFICATIONS = 3;

  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
  ) {}

  async shouldBundleNotification(
    userId: string,
    postId: string,
    type: NotificationType,
  ): Promise<boolean> {
    try {
      // Get recent notifications for this post
      const recentNotifications = await this.notificationsRepository.find({
        where: {
          to_id: userId,
          post_id: postId,
          type: type,
          created_at: new Date(Date.now() - this.BUNDLE_WINDOW_MINUTES * 60 * 1000),
        },
        order: {
          created_at: 'DESC',
        },
      });

      // If we have more than MAX_INDIVIDUAL_NOTIFICATIONS, we should bundle
      return recentNotifications.length >= this.MAX_INDIVIDUAL_NOTIFICATIONS;
    } catch (error) {
      this.logger.error('Error checking if notification should be bundled:', error);
      return false;
    }
  }

  async createBundledNotification(
    userId: string,
    postId: string,
    type: NotificationType,
  ): Promise<Notifications> {
    try {
      // Get all unbundled notifications in the time window
      const recentNotifications = await this.notificationsRepository.find({
        where: {
          to_id: userId,
          post_id: postId,
          type: type,
          created_at: new Date(Date.now() - this.BUNDLE_WINDOW_MINUTES * 60 * 1000),
        },
        order: {
          created_at: 'DESC',
        },
      });

      if (recentNotifications.length === 0) {
        return null;
      }

      // Count different types of interactions
      const interactionCounts = this.countInteractions(recentNotifications);
      
      // Create bundled message
      const bundledMessage = this.createBundledMessage(interactionCounts, type);
      
      // Create new bundled notification
      const bundledNotification = new Notifications();
      bundledNotification.to_id = userId;
      bundledNotification.post_id = postId;
      bundledNotification.type = type;
      bundledNotification.is_read = false;
      bundledNotification.title = 'DayOnes';
      bundledNotification.message = bundledMessage;
      bundledNotification.data = JSON.stringify({
        is_bundled: true,
        original_notifications: recentNotifications.map(n => n.id),
        interaction_counts: interactionCounts,
        post_id: postId
      });

      // Save the bundled notification
      const savedNotification = await this.notificationsRepository.save(bundledNotification);

      // Mark original notifications as bundled
      await this.notificationsRepository.update(
        { id: In(recentNotifications.map(n => n.id)) },
        { is_bundled: true, bundled_notification_id: savedNotification.id }
      );

      return savedNotification;
    } catch (error) {
      this.logger.error('Error creating bundled notification:', error);
      throw error;
    }
  }

  private countInteractions(notifications: Notifications[]): Record<string, number> {
    const counts = {
      likes: 0,
      comments: 0,
      commentLikes: 0
    };

    notifications.forEach(notification => {
      switch (notification.type) {
        case NOTIFICATION_TYPE.LIKE_POST:
          counts.likes++;
          break;
        case NOTIFICATION_TYPE.COMMENT:
          counts.comments++;
          break;
        case NOTIFICATION_TYPE.LIKE_COMMENT:
          counts.commentLikes++;
          break;
      }
    });

    return counts;
  }

  private createBundledMessage(
    counts: Record<string, number>,
    type: NotificationType
  ): string {
    const parts = [];

    if (counts.likes > 0) {
      parts.push(`${counts.likes} ${counts.likes === 1 ? 'person' : 'people'} liked your post`);
    }
    if (counts.comments > 0) {
      parts.push(`${counts.comments} ${counts.comments === 1 ? 'person' : 'people'} commented on your post`);
    }
    if (counts.commentLikes > 0) {
      parts.push(`${counts.commentLikes} ${counts.commentLikes === 1 ? 'person' : 'people'} liked your comments`);
    }

    return parts.join(', ');
  }
} 