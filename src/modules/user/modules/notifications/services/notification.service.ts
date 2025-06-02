import admin, { credential } from 'firebase-admin';
import { forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(FirebaseService.name);

  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
    private userNotificationTokenService: UserNotificationService,
    @Inject(forwardRef(() => UserService)) private userService: UserService,
  ) {
    this.logger.log('=== FirebaseService Constructor ===');
    this.logger.log('Environment variables check:');
    this.logger.log(`FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Not set'}`);
    this.logger.log(`FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set'}`);
    this.logger.log(`FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set'}`);
    if (process.env.FIREBASE_PRIVATE_KEY) {
      this.logger.log(`Private Key Length: ${process.env.FIREBASE_PRIVATE_KEY.length}`);
      this.logger.log(`Private Key Format Check (BEGIN): ${process.env.FIREBASE_PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
      this.logger.log(`Private Key Format Check (END): ${process.env.FIREBASE_PRIVATE_KEY.includes('-----END PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
    }
  }

  private initializeFirebase() {
    this.logger.log('=== Firebase Service Initialization ===');
    try {
      // Initialize Firebase app with service account
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '') || '',
      };

      this.logger.log('=== Firebase Configuration ===');
      this.logger.log(`Project ID: ${serviceAccount.projectId}`);
      this.logger.log(`Client Email: ${serviceAccount.clientEmail}`);
      this.logger.log(`Private Key Length: ${serviceAccount.privateKey.length}`);
      this.logger.log(`Private Key First 10 chars: ${serviceAccount.privateKey.substring(0, 10)}...`);
      this.logger.log(`Private Key Last 10 chars: ...${serviceAccount.privateKey.substring(serviceAccount.privateKey.length - 10)}`);
      this.logger.log(`Private Key Format Check (BEGIN): ${serviceAccount.privateKey.includes('-----BEGIN PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
      this.logger.log(`Private Key Format Check (END): ${serviceAccount.privateKey.includes('-----END PRIVATE KEY-----') ? 'Valid' : 'Invalid'}`);
      this.logger.log('===========================');

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

      this.logger.log('Attempting to initialize Firebase app...');
      const app = admin.initializeApp({
        credential: credential.cert(serviceAccount),
      });
      this.logger.log('Successfully initialized new Firebase app instance');
      return app;
    } catch (initError) {
      this.logger.error('Firebase initialization error:', initError.message);
      this.logger.error('Error stack:', initError.stack);
      throw initError;
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
      this.logger.log('=== Starting Firebase Send Process ===');
      this.logger.log(`Sending notification with payload: ${JSON.stringify(payload, null, 2)}`);
      
      if (!payload?.tokens?.length) {
        this.logger.log('No tokens provided for notification');
        return false;
      }

      // Initialize Firebase for each notification
      const app = this.initializeFirebase();

      // Log token details
      this.logger.log(`Sending to tokens: ${JSON.stringify(payload.tokens)}`);
      this.logger.log(`APNs configuration: ${JSON.stringify({
        bundleId: process.env.APNS_BUNDLE_ID,
        payload: payload.apns,
      }, null, 2)}`);

      this.logger.log('Calling Firebase messaging API...');
      const response = await app.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
        apns: payload.apns,
      });

      this.logger.log(`Firebase messaging response: ${JSON.stringify({
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, idx) => ({
          token: payload.tokens[idx],
          success: resp.success,
          error: resp.error,
        })),
      }, null, 2)}`);
      
      if (response.failureCount > 0) {
        this.logger.log(`Some notifications failed to send: ${JSON.stringify(response.responses)}`);
        
        // Handle invalid tokens
        const invalidTokens = response.responses
          .filter((resp, idx) => !resp.success && 
            (resp.error?.code === 'messaging/mismatched-credential' || 
             resp.error?.code === 'messaging/invalid-registration-token' ||
             resp.error?.code === 'messaging/registration-token-not-registered'))
          .map((_, idx) => payload.tokens[idx]);

        if (invalidTokens.length > 0) {
          this.logger.log(`Removing ${invalidTokens.length} invalid tokens...`);
          await this.userNotificationTokenService.removeInvalidTokens(invalidTokens);
          this.logger.log('Invalid tokens removed successfully');
        }
        
        // Return false if any notifications failed to send
        return false;
      }

      this.logger.log('=== Firebase Send Process Completed ===');
      return true;
    } catch (err) {
      this.logger.error(`Error sending notification: ${err}`);
      this.logger.error(`Error stack: ${err.stack}`);
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
      this.logger.error(
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
      this.logger.log(`Marking notification ${notificationId} as read for user ${userId}`);
      const notification = await this.notificationsRepository.findOne({
        where: { id: notificationId, to_id: userId },
      });

      if (!notification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }

      notification.is_read = true;
      const updatedNotification = await this.notificationsRepository.save(notification);
      this.logger.log(`Notification marked as read: ${JSON.stringify(updatedNotification)}`);
      return updatedNotification;
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error}`);
      this.logger.error(`Error stack: ${error.stack}`);
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
      this.logger.log('=== Starting Notification Process ===');
      this.logger.log(`Adding notification: ${JSON.stringify(addNotificationInput, null, 2)}`);
      
      const notificationDto = this.notificationMapper.dtoToEntity(addNotificationInput);
      this.logger.log(`Created notification DTO: ${JSON.stringify(notificationDto, null, 2)}`);
      
      // Ensure data is always a JSON string
      let parsedData = {};
      try {
        parsedData = JSON.parse(addNotificationInput.data || '{}');
        this.logger.log(`Parsed notification data: ${JSON.stringify(parsedData)}`);
      } catch (e) {
        this.logger.log(`Failed to parse notification data: ${e}`);
        parsedData = { message: addNotificationInput.data };
      }
      
      notificationDto.data = JSON.stringify({
        ...parsedData,
        test_value: 'DAYONES_NOTIF'
      });
      
      this.logger.log('Saving notification to database...');
      const notification = await this.notificationsRepository.save(notificationDto);
      this.logger.log(`Notification saved to database: ${JSON.stringify(notification, null, 2)}`);

      this.logger.log(`Fetching user notification token for user: ${addNotificationInput.toId}`);
      const userToken = await this.userNotificationTokenService.getUserNotificationTokenByUserId(
        addNotificationInput.toId,
      );
      this.logger.log(`User notification token result: ${userToken ? 'Token found' : 'No token found'}`);
      
      if (userToken) {
        this.logger.log(`Token details: ${JSON.stringify({
          userId: userToken.user_id,
          token: userToken.notification_token,
          createdAt: userToken.created_at,
          updatedAt: userToken.updated_at
        }, null, 2)}`);

        try {
          this.logger.log('Fetching sender profile...');
          const senderProfile = await this.userService.findUserById(notification.from_id);
          this.logger.log(`Sender profile: ${JSON.stringify(senderProfile, null, 2)}`);

          this.logger.log('Creating FCM payload...');
          const payload = this.createFcmMulticastPayload(
            notification,
            [userToken.notification_token],
            senderProfile,
            addNotificationInput.postId || null,
            addNotificationInput.conversationId || null,
          );
          this.logger.log(`Created FCM payload: ${JSON.stringify(payload, null, 2)}`);

          this.logger.log('Sending notification to Firebase...');
          const result = await this.sendNotification(payload);
          this.logger.log(`Firebase send result: ${result}`);
        } catch (e) {
          this.logger.error(`Error in notification sending process: ${e}`);
          this.logger.error(`Error stack: ${e.stack}`);
          throw e;
        }
      } else {
        this.logger.log(`No notification token found for user: ${addNotificationInput.toId}`);
        this.logger.log('To receive push notifications, the user needs to:');
        this.logger.log('1. Enable push notifications in the app');
        this.logger.log('2. Have the app register their device token with the backend');
        this.logger.log('3. Have a valid entry in the user-notifications table');
      }

      this.logger.log('=== Notification Process Completed ===');
      return notification;
    } catch (error) {
      this.logger.error(`Error in addNotification: ${error}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }
}
