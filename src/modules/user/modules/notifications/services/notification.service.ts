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
      console.log('Using existing Firebase app instance');
    } catch (error) {
      // Initialize Firebase app with service account if not already initialized
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '') || '',
      };

      console.log('=== Firebase Configuration ===');
      console.log(`Project ID: ${serviceAccount.projectId}`);
      console.log(`Client Email: ${serviceAccount.clientEmail}`);
      console.log(`Private Key Length: ${serviceAccount.privateKey.length}`);
      console.log(`Private Key First 10 chars: ${serviceAccount.privateKey.substring(0, 10)}...`);
      console.log(`Private Key Last 10 chars: ...${serviceAccount.privateKey.substring(serviceAccount.privateKey.length - 10)}`);
      console.log(`Private Key Format Check: ${serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
      console.log(`Private Key Format Check: ${serviceAccount.privateKey.includes('-----END PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
      console.log('===========================');

      try {
        // Add more detailed error handling
        if (!serviceAccount.projectId) {
          throw new Error('FIREBASE_PROJECT_ID is not set');
        }
        if (!serviceAccount.clientEmail) {
          throw new Error('FIREBASE_CLIENT_EMAIL is not set');
        }
        if (!serviceAccount.privateKey) {
          throw new Error('FIREBASE_PRIVATE_KEY is not set');
        }
        if (!serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          throw new Error('FIREBASE_PRIVATE_KEY is not properly formatted');
        }

        this.app = admin.initializeApp({
          credential: credential.cert(serviceAccount),
        });
        console.log('Initialized new Firebase app instance');
      } catch (initError) {
        console.error(`Firebase initialization error: ${initError.message}`);
        console.error(`Error stack: ${initError.stack}`);
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
      console.log('=== Starting Firebase Send Process ===');
      console.log(`Sending notification with payload: ${JSON.stringify(payload, null, 2)}`);
      
      if (!payload?.tokens?.length) {
        console.log('No tokens provided for notification');
        return false;
      }

      // Log token details
      console.log(`Sending to tokens: ${JSON.stringify(payload.tokens)}`);
      console.log(`APNs configuration: ${JSON.stringify({
        bundleId: process.env.APNS_BUNDLE_ID,
        payload: payload.apns,
      }, null, 2)}`);

      console.log('Calling Firebase messaging API...');
      const response = await this.app.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
        apns: payload.apns,
      });

      console.log(`Firebase messaging response: ${JSON.stringify({
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, idx) => ({
          token: payload.tokens[idx],
          success: resp.success,
          error: resp.error,
        })),
      }, null, 2)}`);
      
      if (response.failureCount > 0) {
        console.log(`Some notifications failed to send: ${JSON.stringify(response.responses)}`);
        
        // Handle invalid tokens
        const invalidTokens = response.responses
          .filter((resp, idx) => !resp.success && 
            (resp.error?.code === 'messaging/mismatched-credential' || 
             resp.error?.code === 'messaging/invalid-registration-token' ||
             resp.error?.code === 'messaging/registration-token-not-registered'))
          .map((_, idx) => payload.tokens[idx]);

        if (invalidTokens.length > 0) {
          console.log(`Removing ${invalidTokens.length} invalid tokens...`);
          await this.userNotificationTokenService.removeInvalidTokens(invalidTokens);
          console.log('Invalid tokens removed successfully');
        }
        
        // Return false if any notifications failed to send
        return false;
      }

      console.log('=== Firebase Send Process Completed ===');
      return true;
    } catch (err) {
      console.error(`Error sending notification: ${err}`);
      console.error(`Error stack: ${err.stack}`);
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
      console.log(`Marking notification ${notificationId} as read for user ${userId}`);
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, to_id: userId },
      });

      if (!notification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }

      notification.is_read = true;
      const updatedNotification = await this.notificationsRepository.save(notification);
      console.log(`Notification marked as read: ${JSON.stringify(updatedNotification)}`);
      return updatedNotification;
    } catch (error) {
      console.error(`Error marking notification as read: ${error}`);
      console.error(`Error stack: ${error.stack}`);
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
      console.log('=== Starting Notification Process ===');
      console.log(`Adding notification: ${JSON.stringify(addNotificationInput, null, 2)}`);
      
      const notificationDto = this.notificationMapper.dtoToEntity(addNotificationInput);
      console.log(`Created notification DTO: ${JSON.stringify(notificationDto, null, 2)}`);
      
      // Ensure data is always a JSON string
      let parsedData = {};
      try {
        parsedData = JSON.parse(addNotificationInput.data || '{}');
        console.log(`Parsed notification data: ${JSON.stringify(parsedData)}`);
      } catch (e) {
        console.log(`Failed to parse notification data: ${e}`);
        parsedData = { message: addNotificationInput.data };
      }
      
      notificationDto.data = JSON.stringify({
        ...parsedData,
        test_value: 'DAYONES_NOTIF'
      });
      
      console.log('Saving notification to database...');
      const notification = await this.notificationsRepository.save(notificationDto);
      console.log(`Notification saved to database: ${JSON.stringify(notification, null, 2)}`);

      console.log(`Fetching user notification token for user: ${addNotificationInput.toId}`);
      const userToken = await this.userNotificationTokenService.getUserNotificationTokenByUserId(
        addNotificationInput.toId,
      );
      console.log(`User notification token result: ${userToken ? 'Token found' : 'No token found'}`);
      
      if (userToken) {
        console.log(`Token details: ${JSON.stringify({
          userId: userToken.user_id,
          token: userToken.notification_token,
          createdAt: userToken.created_at,
          updatedAt: userToken.updated_at
        }, null, 2)}`);

        try {
          console.log('Fetching sender profile...');
          const senderProfile = await this.userService.findUserById(notification.from_id);
          console.log(`Sender profile: ${JSON.stringify(senderProfile, null, 2)}`);

          console.log('Creating FCM payload...');
          const payload = this.createFcmMulticastPayload(
            notification,
            [userToken.notification_token],
            senderProfile,
            addNotificationInput.postId || null,
            addNotificationInput.conversationId || null,
          );
          console.log(`Created FCM payload: ${JSON.stringify(payload, null, 2)}`);

          console.log('Sending notification to Firebase...');
          const result = await this.sendNotification(payload);
          console.log(`Firebase send result: ${result}`);
        } catch (e) {
          console.error(`Error in notification sending process: ${e}`);
          console.error(`Error stack: ${e.stack}`);
          throw e;
        }
      } else {
        console.log(`No notification token found for user: ${addNotificationInput.toId}`);
        console.log('To receive push notifications, the user needs to:');
        console.log('1. Enable push notifications in the app');
        console.log('2. Have the app register their device token with the backend');
        console.log('3. Have a valid entry in the user-notifications table');
      }

      console.log('=== Notification Process Completed ===');
      return notification;
    } catch (error) {
      console.error(`Error in addNotification: ${error}`);
      console.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }
}
