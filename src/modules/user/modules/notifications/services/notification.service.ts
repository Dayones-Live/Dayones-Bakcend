import admin, { credential } from 'firebase-admin';
import { forwardRef, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Notifications } from '@notifications/entities/notifications.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BUNDLE_NOTIFICATIONS_UNIQUE_KEYS, ERROR_MESSAGES } from '@app/shared/constants/constants';
import { NotificationMapper } from '@notifications/dto/notifications.mapper';
import { AddNotificationInput } from '@notifications/dto/types';
import { UserNotificationService } from '@user-notifications/services/user-notification.service';
import { MulticastMessage } from 'firebase-admin/lib/messaging/messaging-api';
import { UserService } from '@user/services/user.service';
import { NOTIFICATION_TITLE } from '@notifications/constants';

@Injectable()
export class FirebaseService {
  private readonly app;

  constructor(
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private notificationMapper: NotificationMapper,
    private userNotificationTokenService: UserNotificationService,
    @Inject(forwardRef(() => UserService)) private userService: UserService,
  ) {
    try {
      process.stdout.write('Initializing Firebase with project ID: ' + process.env.FIREBASE_PROJECT_ID + '\n');
      
      // Initialize Firebase app with service account
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

      this.app = admin.initializeApp({
        credential: credential.cert(serviceAccount),
      });

      process.stdout.write('Firebase initialized successfully\n');
    } catch (error) {
      process.stdout.write('Error initializing Firebase: ' + error + '\n');
      throw error;
    }
  }

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
      }

      process.stdout.write('=== Firebase Send Process Completed ===\n');
      return true;
    } catch (err) {
      process.stdout.write(`Error sending notification: ${err}\n`);
      process.stdout.write(`Error stack: ${err.stack}\n`);
      return false;
    }
  }

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
      case NOTIFICATION_TITLE.COMMENT:
      case 'Comment':
        action = 'post';
        id = postId;
        redirectUrl = `/post/${postId}`;
        break;
      case NOTIFICATION_TITLE.MESSAGE:
        action = 'conversation';
        id = conversationId;
        redirectUrl = `conversation/${conversationId}`;
        break;
      case NOTIFICATION_TITLE.LIKE_COMMENT:
      case NOTIFICATION_TITLE.DISLIKE_COMMENT:
        action = 'post';
        id = postId ? `${postId}#comment-${notification.id}` : notification.id;
        redirectUrl = `/post/${postId}`;
        break;
      default:
        action = 'profile';
        id = notification.from_id;
        redirectUrl = `myapp://profile/${notification.from_id}`;
    }

    const senderProfiles = JSON.stringify({
      image: senderProfile?.avatar_url || '',
      senderName: senderProfile?.full_name || 'Unknown',
      senderEmail: senderProfile?.email || '',
    });

    const payload: MulticastMessage = {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        action: action,
        id: id,
        senderProfiles,
        redirect_url: redirectUrl,
        notification_data: notification.data,
        test_value: 'DAYONES_NOTIF',
      },
      android: {
        notification: {
          tag: BUNDLE_NOTIFICATIONS_UNIQUE_KEYS.ANDROID_BUNDLE_ID,
          color: '#ff0000',
        },
      },
    };

    // Only add APNs configuration if APNS_BUNDLE_ID is provided
    if (process.env.APNS_BUNDLE_ID) {
      payload.apns = {
        payload: {
          aps: {
            thread_id: BUNDLE_NOTIFICATIONS_UNIQUE_KEYS.IOS_BUNDLE_ID,
          },
        },
      };
    }

    return payload;
  }
} 