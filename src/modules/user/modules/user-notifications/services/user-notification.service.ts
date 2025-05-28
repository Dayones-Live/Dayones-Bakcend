import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from '@user-notifications/entities/user-notifications.entity';
import { UpsertUserNotificationInput } from '@user-notifications/dto/types';
import { UserNotificationMapper } from '../dto/user-notification.mapper';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';

@Injectable()
export class UserNotificationService {
  constructor(
    @InjectRepository(UserNotification)
    private userNotificationRepository: Repository<UserNotification>,
    private userNotificationMapper: UserNotificationMapper,
  ) {}
  /**
   * Service to upsert the user device notification
   * @param upsertUserNotificationInput
   * @returns {UserNotification}
   */
  async upsertUserNotification(
    upsertUserNotificationInput: UpsertUserNotificationInput,
  ): Promise<UserNotification> {
    try {
      process.stdout.write(`Upserting notification token for user ${upsertUserNotificationInput.userId}\n`);
      process.stdout.write(`New token: ${upsertUserNotificationInput.notificationToken}\n`);

      // Check if notification for the user already exists
      let userNotification = await this.userNotificationRepository.findOne({
        where: { user_id: upsertUserNotificationInput.userId },
      });

      if (userNotification) {
        process.stdout.write(`Found existing token: ${userNotification.notification_token}\n`);
        // Update existing user notification token
        userNotification.notification_token = upsertUserNotificationInput.notificationToken;
        const updated = await this.userNotificationRepository.save(userNotification);
        process.stdout.write(`Token updated successfully\n`);
        return updated;
      }

      // Create new notification token
      const newToken = this.userNotificationRepository.create({
        user_id: upsertUserNotificationInput.userId,
        notification_token: upsertUserNotificationInput.notificationToken,
      });
      const saved = await this.userNotificationRepository.save(newToken);
      process.stdout.write(`New token saved successfully\n`);
      return saved;
    } catch (error) {
      process.stdout.write(`Error upserting notification token: ${error}\n`);
      throw new HttpException(
        `User Notification Token update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   *
   * @param userId
   * @returns
   */
  async getUserNotificationTokenByUserId(
    userId: string,
  ): Promise<UserNotification | null> {
    try {
      const token = await this.userNotificationRepository.findOne({
        where: {
          user_id: userId,
        },
      });
      return token;
    } catch (error) {
      console.error(
        '🚀 ~ file:user-notification.service.ts:96 ~ UserNotificationService ~ error:',
        error,
      );
      throw error;
    }
  }

  async updateUserNotificationToken(
    userId: string,
    notificationToken: string,
  ): Promise<UserNotification> {
    try {
      process.stdout.write(`Updating notification token for user ${userId}\n`);
      process.stdout.write(`New token: ${notificationToken}\n`);

      const existingToken = await this.userNotificationRepository.findOne({
        where: { user_id: userId },
      });

      if (existingToken) {
        process.stdout.write(`Found existing token: ${existingToken.notification_token}\n`);
        existingToken.notification_token = notificationToken;
        const updated = await this.userNotificationRepository.save(existingToken);
        process.stdout.write(`Token updated successfully\n`);
        return updated;
      }

      const newToken = this.userNotificationRepository.create({
        user_id: userId,
        notification_token: notificationToken,
      });
      const saved = await this.userNotificationRepository.save(newToken);
      process.stdout.write(`New token saved successfully\n`);
      return saved;
    } catch (error) {
      process.stdout.write(`Error updating notification token: ${error}\n`);
      throw error;
    }
  }
}
