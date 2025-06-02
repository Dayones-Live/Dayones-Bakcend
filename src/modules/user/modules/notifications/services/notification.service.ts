import admin, { credential } from 'firebase-admin';
import { forwardRef, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Notifications } from '../entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BUNDLE_NOTIFICATIONS_UNIQUE_KEYS, ERROR_MESSAGES } from '@app/shared/constants/constants';
import { NotificationMapper } from '../dto/notifications.mapper';
import { AddNotificationInput } from '../dto/types';
import { UserNotificationService } from '../../user-notifications/services/user-notification.service';
import { MulticastMessage } from 'firebase-admin/lib/messaging/messaging-api';

import { UserService } from '../../../services/user.service';
import { NOTIFICATION_TITLE } from '../constants';

interface EnrichedNotification {
  id: string;
  title: string;
  message: string;
  data: string | Record<string, any>; // Allow data to be either string or object
  is_read: boolean;
  type: string; // Adjust type if `NOTIFICATION_TYPE` is defined
  created_at: Date;
  updated_at: Date;
  from_user_profile: {
    id: string;
    username: string;
    img_profile: string;
    email: string;
    action: string;
  };
  to_user_profile: {
    id: string;
    username: string;
    img_profile: string;
    email: string;
    action: string;
  };
}


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
    @Inject(forwardRef(() => UserService)) private userService: UserService,
  ) {
    // Check if Firebase app is already initialized
    try {
      this.app = admin.app();
      process.stdout.write('Using existing Firebase app instance\n');
    } catch (error) {
      // Initialize Firebase app with service account if not already initialized
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '') || '',
      };

      process.stdout.write('=== Firebase Configuration ===\n');
      process.stdout.write(`Project ID: ${serviceAccount.projectId}\n`);
      process.stdout.write(`Client Email: ${serviceAccount.clientEmail}\n`);
      process.stdout.write(`Private Key Length: ${serviceAccount.privateKey.length}\n`);
      process.stdout.write(`Private Key First 10 chars: ${serviceAccount.privateKey.substring(0, 10)}...\n`);
      process.stdout.write(`Private Key Last 10 chars: ...${serviceAccount.privateKey.substring(serviceAccount.privateKey.length - 10)}\n`);
      process.stdout.write('===========================\n');

      try {
        this.app = admin.initializeApp({
          credential: credential.cert(serviceAccount),
        });
        process.stdout.write('Initialized new Firebase app instance\n');
      } catch (initError) {
        process.stdout.write(`Firebase initialization error: ${initError.message}\n`);
        process.stdout.write(`Error stack: ${initError.stack}\n`);
        throw initError;
      }
    }
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
    senderProfile: any,
    postId: any,
    conversationId: any,
  ): MulticastMessage {
    let action = '';
    let id = '';
    let redirectUrl = '';

    switch (notification.title) {
      case NOTIFICATION_TITLE.LIKE_POST:
      case NOTIFICATION_TITLE.DISLIKE_POST:
      case NOTIFICATION_TITLE.REACTION:
      case NOTIFICATION_TITLE.COMMENT: // Add this case to match "Comment"
      case 'Comment': // Match the exact string returned in the title
        action = 'post';
        id = postId;
        redirectUrl = `/post/${postId}`; // Deep link for a post
        break;
      case NOTIFICATION_TITLE.MESSAGE:
        action = 'conversation';
        id = conversationId;
        redirectUrl = `conversation/${conversationId}`; // Deep link for a conversation
        break;
      case NOTIFICATION_TITLE.LIKE_COMMENT:
      case NOTIFICATION_TITLE.DISLIKE_COMMENT:
        action = 'post';
        id = postId ? `${postId}#comment-${notification.id}` : notification.id;
        redirectUrl = `/post/${postId}`;

        break;
      default:
        action = 'profile';
        id = notification.from_id; // Default to sender's profile
        redirectUrl = `myapp://profile/${notification.from_id}`; // Deep link for a profile

    }
  
    const senderProfiles = JSON.stringify({
      image: senderProfile?.avatar_url || '',
      senderName: senderProfile?.full_name || 'Unknown',
      senderEmail: senderProfile?.email || '',
    });

    // return {
    //   tokens: tokens,
    //   notification: {
    //     title: notification.title,
    //     body: notification.message,
    //   },
    //   data: {
    //     action: action, // Screen name
    //     id: id,  
    //     senderProfiles,
    //   },
    // };
    return {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        action: action, // Screen name
        id: id,  
        senderProfiles,
        redirect_url: redirectUrl, // Include the redirect_url here
        notification_data: notification.data, // Include the original notification data
        test_value: 'DAYONES_NOTIF', // Test value to verify deployment
      },
      android: {
        notification: {
          tag: BUNDLE_NOTIFICATIONS_UNIQUE_KEYS.ANDROID_BUNDLE_ID, // Grouping key
          color: '#ff0000',
        },
      },
      apns: {
        payload: {
          aps: {
            thread_id: BUNDLE_NOTIFICATIONS_UNIQUE_KEYS.IOS_BUNDLE_ID, // Grouping key for iOS
          },
        },
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
      process.stdout.write('=== Starting Firebase Send Process ===\n');
      process.stdout.write(`Sending notification with payload: ${JSON.stringify(payload, null, 2)}\n`);
      
      if (!payload?.tokens?.length) {
        process.stdout.write('No tokens provided for notification\n');
        return false;
      }

      // Log token details
      process.stdout.write(`Sending to tokens: ${JSON.stringify(payload.tokens)}\n`);
      process.stdout.write(`APNs configuration: ${JSON.stringify({
        bundleId: process.env.APNS_BUNDLE_ID,
        payload: payload.apns,
      }, null, 2)}\n`);

      process.stdout.write('Calling Firebase messaging API...\n');
      const response = await this.app.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
        apns: payload.apns,
      });

      process.stdout.write(`Firebase messaging response: ${JSON.stringify({
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, idx) => ({
          token: payload.tokens[idx],
          success: resp.success,
          error: resp.error,
        })),
      }, null, 2)}\n`);
      
      if (response.failureCount > 0) {
        process.stdout.write(`Some notifications failed to send: ${JSON.stringify(response.responses)}\n`);
        
        // Handle invalid tokens
        const invalidTokens = response.responses
          .filter((resp, idx) => !resp.success && 
            (resp.error?.code === 'messaging/mismatched-credential' || 
             resp.error?.code === 'messaging/invalid-registration-token' ||
             resp.error?.code === 'messaging/registration-token-not-registered'))
          .map((_, idx) => payload.tokens[idx]);

        if (invalidTokens.length > 0) {
          process.stdout.write(`Removing ${invalidTokens.length} invalid tokens...\n`);
          await this.userNotificationTokenService.removeInvalidTokens(invalidTokens);
          process.stdout.write('Invalid tokens removed successfully\n');
        }
      }

      process.stdout.write('=== Firebase Send Process Completed ===\n');
      return true;
    } catch (err) {
      process.stdout.write(`Error sending notification: ${err}\n`);
      process.stdout.write(`Error stack: ${err.stack}\n`);
      return false;
    }
  }

  /**
   * Service to fetch all notifications
   * @returns {Notifications[]}
   */
  async getAllNotification(userId: string): Promise<EnrichedNotification[]> {
    try {
      const notifications: Notifications[] = await this.notificationsRepository.find({
        where: {
          to_id: userId,
        },
      });
  
      const enrichedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          const fromUserProfile = await this.userService.findUserById(notification.from_id);
          const toUserProfile = await this.userService.findUserById(notification.to_id);
  
          // Parse the data field if it exists
          let parsedData = {};
          try {
            parsedData = JSON.parse(notification.data || '{}');
          } catch (e) {
            // If data is not valid JSON, use it as a message
            parsedData = { message: notification.data };
          }
  
          return {
            ...notification, // Include all properties of `Notifications`
            data: parsedData, // Return parsed data instead of string
            from_user_profile: {
              id: fromUserProfile?.id || '',
              username: fromUserProfile?.full_name || '',
              img_profile: fromUserProfile?.avatar_url || '',
              email: fromUserProfile?.email || '',
              action: this.getAction(notification.title),
            },
            to_user_profile: {
              id: toUserProfile?.id || '',
              username: toUserProfile?.full_name || '',
              img_profile: toUserProfile?.avatar_url || '',
              email: toUserProfile?.email || '',
              action: this.getAction(notification.title),
            },
          };
        }),
      );
  
      return enrichedNotifications;
    } catch (error) {
      console.error(
        '🚀 ~ file:notification.service.ts:96 ~ getAllNotification ~ error:',
        error,
      );
      throw error;
    }
  }
  

  /**
   * Maps notification titles to actions.
   * @param title Notification title
   * @returns Corresponding action string
   */
  private getAction(title: string): string {
    switch (title) {
      case NOTIFICATION_TITLE.LIKE_POST:
      case NOTIFICATION_TITLE.DISLIKE_POST:
      case NOTIFICATION_TITLE.REACTION:
      case NOTIFICATION_TITLE.COMMENT: // Add this case to match "Comment"
      case 'Comment': // Match the exact string returned in the title
        return 'comment';
      case NOTIFICATION_TITLE.MESSAGE:
        return 'conversation'; 
      case NOTIFICATION_TITLE.LIKE_COMMENT:
      case NOTIFICATION_TITLE.DISLIKE_COMMENT:
        return 'like';
      default:
        return 'other';
    }

  }

  /**
   * Service to mark notification as read
   * @param notificationId
   * @param userId
   * @returns {Notifications}
   */
  async markAsReadNotification(notificationId: string, userId: string): Promise<Notifications> {
    try {
      process.stdout.write(`Marking notification ${notificationId} as read for user ${userId}\n`);
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, to_id: userId },
      });

      if (!notification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }

      notification.is_read = true;
      const updatedNotification = await this.notificationsRepository.save(notification);
      process.stdout.write(`Notification marked as read: ${JSON.stringify(updatedNotification)}\n`);
      return updatedNotification;
    } catch (error) {
      process.stdout.write(`Error marking notification as read: ${error}\n`);
      process.stdout.write(`Error stack: ${error.stack}\n`);
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
      process.stdout.write('=== Starting Notification Process ===\n');
      process.stdout.write(`Adding notification: ${JSON.stringify(addNotificationInput, null, 2)}\n`);
      
      const notificationDto = this.notificationMapper.dtoToEntity(addNotificationInput);
      process.stdout.write(`Created notification DTO: ${JSON.stringify(notificationDto, null, 2)}\n`);
      
      // Ensure data is always a JSON string
      let parsedData = {};
      try {
        parsedData = JSON.parse(addNotificationInput.data || '{}');
        process.stdout.write(`Parsed notification data: ${JSON.stringify(parsedData)}\n`);
      } catch (e) {
        process.stdout.write(`Failed to parse notification data: ${e}\n`);
        parsedData = { message: addNotificationInput.data };
      }
      
      notificationDto.data = JSON.stringify({
        ...parsedData,
        test_value: 'DAYONES_NOTIF'
      });
      
      process.stdout.write('Saving notification to database...\n');
      const notification = await this.notificationsRepository.save(notificationDto);
      process.stdout.write(`Notification saved to database: ${JSON.stringify(notification, null, 2)}\n`);

      process.stdout.write(`Fetching user notification token for user: ${addNotificationInput.toId}\n`);
      const userToken = await this.userNotificationTokenService.getUserNotificationTokenByUserId(
        addNotificationInput.toId,
      );
      process.stdout.write(`User notification token result: ${userToken ? 'Token found' : 'No token found'}\n`);
      
      if (userToken) {
        process.stdout.write(`Token details: ${JSON.stringify({
          userId: userToken.user_id,
          token: userToken.notification_token,
          createdAt: userToken.created_at,
          updatedAt: userToken.updated_at
        }, null, 2)}\n`);

        try {
          process.stdout.write('Fetching sender profile...\n');
          const senderProfile = await this.userService.findUserById(notification.from_id);
          process.stdout.write(`Sender profile: ${JSON.stringify(senderProfile, null, 2)}\n`);

          process.stdout.write('Creating FCM payload...\n');
          const payload = this.createFcmMulticastPayload(
            notification,
            [userToken.notification_token],
            senderProfile,
            addNotificationInput.postId || null,
            addNotificationInput.conversationId || null,
          );
          process.stdout.write(`Created FCM payload: ${JSON.stringify(payload, null, 2)}\n`);

          process.stdout.write('Sending notification to Firebase...\n');
          const result = await this.sendNotification(payload);
          process.stdout.write(`Firebase send result: ${result}\n`);
        } catch (e) {
          process.stdout.write(`Error in notification sending process: ${e}\n`);
          process.stdout.write(`Error stack: ${e.stack}\n`);
          throw e;
        }
      } else {
        process.stdout.write(`No notification token found for user: ${addNotificationInput.toId}\n`);
        process.stdout.write('To receive push notifications, the user needs to:\n');
        process.stdout.write('1. Enable push notifications in the app\n');
        process.stdout.write('2. Have the app register their device token with the backend\n');
        process.stdout.write('3. Have a valid entry in the user-notifications table\n');
      }

      process.stdout.write('=== Notification Process Completed ===\n');
      return notification;
    } catch (error) {
      process.stdout.write(`Error in addNotification: ${error}\n`);
      process.stdout.write(`Error stack: ${error.stack}\n`);
      throw error;
    }
  }
}
