import admin, { credential } from 'firebase-admin';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { initializeApp } from 'firebase-admin';
import { Notifications } from '../entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { NotificationMapper } from '../dto/notifications.mapper';
import { AddNotificationInput } from '../dto/types';
import { NOTIFICATION_TYPE } from '../constants';
import { UserNotificationService } from '../../user-notifications/services/user-notification.service';

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
   * Sends a notification to the specified device tokens.
   *
   * @param deviceTokens - An array of device tokens to send the notification to.
   * @param payload - The notification payload to be sent.
   * @returns A promise that resolves to `true` if the notification is sent successfully, or `false` if an error occurs.
   */
  async sendNotification(
    deviceTokens: string[],
    payload: any,
  ): Promise<boolean> {
    const notificationOptions = {
      priority: 'high',
      contentAvailable: true,
    };

    try {
      if (deviceTokens.length) {
        await this.app
          .messaging()
          .sendToDevice(deviceTokens, payload, notificationOptions);
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
      //await this.sendNotification([userToken.notification_token], notification);
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
