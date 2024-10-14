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
      // Check if notification for the user already exists
      let userNotification = await this.userNotificationRepository.findOne({
        where: { user_id: upsertUserNotificationInput.userId },
      });
      let userNotificationDto;
      if (userNotification) {
        // Update existing user notification token
        userNotificationDto = this.userNotificationMapper.dtoToEntityUpdate(
          userNotification,
          upsertUserNotificationInput,
        );
      } else {
        userNotificationDto = this.userNotificationMapper.dtoToEntity(
          upsertUserNotificationInput,
        );
      }

      // Save the user notification (will perform update or insert)
      return await this.userNotificationRepository.save(userNotificationDto);
    } catch (error) {
      console.error(
        '🚀 ~ file: user-notification.service.ts:96 ~ UserNotificationService ~ upsertUserNotification ~ error:',
        error,
      );
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
}
