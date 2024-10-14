import admin, { credential } from 'firebase-admin';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { initializeApp } from 'firebase-admin';
import { Notifications } from '../entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { NotificationMapper } from '../dto/notifications.mapper';
import { AddNotificationInput } from '../dto/types';
import { UserNotificationService } from '../../user-notifications/services/user-notification.service';
import { MulticastMessage } from 'firebase-admin/lib/messaging/messaging-api';

@Injectable()
/**
 * FirebaseService is responsible for handling Firebase-related operations, such as sending notifications.
 */
export class FirebaseService {
  private readonly app;

  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
    private userNotificationTokenService: UserNotificationService,
  ) {
    // Initialize Firebase app with service account
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    this.app = admin.initializeApp({
      credential: credential.cert(serviceAccount),
    });
  }

  /**
   * Creates a Firebase Cloud Messaging (FCM) payload from a notification entity.
   *
   * @param notification - The notification entity containing details such as title, message,
   *                       sender ID, receiver ID, notification type, and relevant timestamps.
   * @param tokens - An array of device tokens to which the notification will be sent.
   * @returns {MulticastMessage} object representing the formatted FCM payload, including
   *          both `tokens` and structured `notification` and `data` fields, ready for dispatch through FCM.
   */

  createFcmMulticastPayload(
    notification: Notifications,
    tokens: string[],
  ): MulticastMessage {
    return {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        id: notification.id,
        from_id: notification.from_id,
        to_id: notification.to_id,
        type: notification.type,
        is_read: notification.is_read ? 'true' : 'false',
        created_at: notification.created_at.toISOString(),
        updated_at: notification.updated_at.toISOString(),
      },
    };
  }

  /**
   * Sends a notification to the specified device tokens.
   *
   * @param deviceTokens - An array of device tokens to send the notification to.
   * @param payload - The notification payload to be sent.
   * @returns A promise that resolves to `true` if the notification is sent successfully, or `false` if an error occurs.
   */
  async sendNotification(payload: MulticastMessage): Promise<boolean> {
    try {
      if (payload?.tokens.length) {
        await this.app.messaging().sendEachForMulticast({
          tokens: payload?.tokens,
          notification: payload?.notification,
          data: payload?.data,
        });
      }
      return true;
    } catch (err) {
      console.error('Error sending notification', err); // Simple error logging to console
      return false;
    }
  }

  /**
   * Service to fetch all notifications
   * @returns {Notifications[]}
   */
  async getAllNotification(userId: string): Promise<Notifications[]> {
    try {
      const notification: Notifications[] =
        await this.notificationsRepository.find({
          where: {
            to_id: userId,
          },
        });
      return notification;
    } catch (error) {
      console.error(
        '🚀 ~ file:notification.service.ts:96 ~ getAllNotification ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to mark notification as read
   * @param id
   * @param userId
   * @returns {Notifications}
   */
  async markAsReadNotification(
    id: string,
    userId: string,
  ): Promise<Notifications> {
    try {
      const notification = await this.notificationsRepository.findOne({
        where: {
          id,
          to_id: userId,
        },
      });
      if (!notification) {
        throw new HttpException(
          ERROR_MESSAGES.NOTIFICATION_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      notification.is_read = true;
      const updatedNotification =
        await this.notificationsRepository.save(notification);
      return updatedNotification;
    } catch (error) {
      console.error(
        '🚀 ~ file:notification.service.ts:96 ~ markAsReadNotification ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to add Notification
   * @param addNotificationInput
   * @returns {Notifications}
   */
  async addNotification(
    addNotificationInput: AddNotificationInput,
  ): Promise<Notifications> {
    try {
      const notificationDto =
        this.notificationMapper.dtoToEntity(addNotificationInput);
      const notification =
        await this.notificationsRepository.save(notificationDto);
      const userToken =
        await this.userNotificationTokenService.getUserNotificationTokenByUserId(
          addNotificationInput.toId,
        );
      if (userToken) {
        try {
          const payload = this.createFcmMulticastPayload(notification, [
            userToken.notification_token,
          ]);
          await this.sendNotification(payload);
        } catch (e) {
          console.error('🚀 ~ FirebaseService ~ e:', e);
        }
      }

      return notification;
    } catch (error) {
      console.error(
        '🚀 ~ file:notification.service.ts:96 ~ addNotification ~ error:',
        error,
      );
      throw error;
    }
  }
}
