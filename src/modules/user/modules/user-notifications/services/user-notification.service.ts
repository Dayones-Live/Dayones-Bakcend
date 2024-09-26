import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from '../entities/user-notifications.entity';
import { UpsertUserNotificationInput } from '../dto/types';

@Injectable()
export class UserNotificationService {
  constructor(
    @InjectRepository(UserNotification)
    private userNotificationRepository: Repository<UserNotification>,
  ) {}

  async upsertUserNotification(
    upsertUserNotificationInput: UpsertUserNotificationInput,
  ): Promise<UserNotification> {
    const { user_id, notification_token } = upsertUserNotificationInput;

    try {
      // Check if notification for the user already exists
      let userNotification = await this.userNotificationRepository.findOne({
        where: { user_id },
      });

      if (userNotification) {
        // Update existing user notification token
        userNotification.notification_token =
          notification_token || userNotification?.notification_token;
      } else {
        // Create a new user notification if not found
        userNotification = this.userNotificationRepository.create({
          user_id,
          notification_token,
        });
      }

      // Save the user notification (will perform update or insert)
      return await this.userNotificationRepository.save(userNotification);
    } catch (error) {
      console.error(
        '🚀 ~ file: user-notification.service.ts:96 ~ UserService ~ upsertUserNotification ~ error:',
        error,
      );
      throw new HttpException(
        `User Notification Token update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
