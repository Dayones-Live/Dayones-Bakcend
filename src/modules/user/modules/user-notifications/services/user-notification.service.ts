import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from '@user-notifications/entities/user-notifications.entity';
import { UpsertUserNotificationInput } from '@user-notifications/dto/types';
import { UserNotificationMapper } from '../dto/user-notification.mapper';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { In } from 'typeorm';

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
      process.stdout.write('=== Starting User Notification Token Update ===\n');
      process.stdout.write(`User ID: ${upsertUserNotificationInput.userId}\n`);
      process.stdout.write(`New Token: ${upsertUserNotificationInput.notificationToken}\n`);
      process.stdout.write(`Token Length: ${upsertUserNotificationInput.notificationToken.length}\n`);

      // Check if notification for the user already exists
      let userNotification = await this.userNotificationRepository.findOne({
        where: { user_id: upsertUserNotificationInput.userId },
      });

      if (userNotification) {
        process.stdout.write(`Found existing token: ${userNotification.notification_token}\n`);
        process.stdout.write(`Existing token length: ${userNotification.notification_token.length}\n`);
        
        // Only update if the token has actually changed
        if (userNotification.notification_token !== upsertUserNotificationInput.notificationToken) {
          userNotification.notification_token = upsertUserNotificationInput.notificationToken;
          const updated = await this.userNotificationRepository.save(userNotification);
          process.stdout.write(`Token updated successfully\n`);
          process.stdout.write(`Updated token: ${updated.notification_token}\n`);
        } else {
          process.stdout.write(`Token unchanged, skipping update\n`);
        }
        process.stdout.write('=== User Notification Token Update Completed ===\n');
        return userNotification;
      }

      // Create new notification token
      const newToken = this.userNotificationRepository.create({
        user_id: upsertUserNotificationInput.userId,
        notification_token: upsertUserNotificationInput.notificationToken,
      });
      const saved = await this.userNotificationRepository.save(newToken);
      process.stdout.write(`New token saved successfully\n`);
      process.stdout.write(`Saved token: ${saved.notification_token}\n`);
      process.stdout.write('=== User Notification Token Update Completed ===\n');
      return saved;
    } catch (error) {
      process.stdout.write(`Error upserting notification token: ${error}\n`);
      process.stdout.write(`Error stack: ${error.stack}\n`);
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

  async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      process.stdout.write(`Removing invalid tokens: ${JSON.stringify(tokens)}\n`);
      await this.userNotificationRepository.delete({
        notification_token: In(tokens)
      });
      process.stdout.write('Invalid tokens removed from database\n');
    } catch (error) {
      process.stdout.write(`Error removing invalid tokens: ${error}\n`);
      process.stdout.write(`Error stack: ${error.stack}\n`);
      throw error;
    }
  }
}
