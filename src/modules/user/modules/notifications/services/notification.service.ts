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
      // Initialize Firebase app with service account
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

      console.log('Initializing Firebase with project ID:', process.env.FIREBASE_PROJECT_ID);
      
      this.app = admin.initializeApp({
        credential: credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      // Configure APNs
      if (!process.env.APNS_BUNDLE_ID) {
        throw new Error('APNS_BUNDLE_ID environment variable is required');
      }
      console.log('Firebase initialized successfully with APNs bundle ID:', process.env.APNS_BUNDLE_ID);
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  async addNotification(
    addNotificationInput: AddNotificationInput,
  ): Promise<Notifications> {
    try {
      console.log('=== Starting Notification Process ===');
      console.log('Adding notification:', JSON.stringify(addNotificationInput, null, 2));
      
      const notificationDto = this.notificationMapper.dtoToEntity(addNotificationInput);
      console.log('Created notification DTO:', JSON.stringify(notificationDto, null, 2));
      
      // Ensure data is always a JSON string
      let parsedData = {};
      try {
        parsedData = JSON.parse(addNotificationInput.data || '{}');
        console.log('Parsed notification data:', parsedData);
      } catch (e) {
        console.warn('Failed to parse notification data:', e);
        parsedData = { message: addNotificationInput.data };
      }
      
      notificationDto.data = JSON.stringify({
        ...parsedData,
        test_value: 'DAYONES_NOTIF'
      });
      
      console.log('Saving notification to database...');
      const notification = await this.notificationsRepository.save(notificationDto);
      console.log('Notification saved to database:', JSON.stringify(notification, null, 2));

      console.log('Fetching user notification token...');
      const userToken = await this.userNotificationTokenService.getUserNotificationTokenByUserId(
        addNotificationInput.toId,
      );
      console.log('User notification token:', userToken);

      if (userToken) {
        try {
          console.log('Fetching sender profile...');
          const senderProfile = await this.userService.findUserById(notification.from_id);
          console.log('Sender profile:', JSON.stringify(senderProfile, null, 2));

          console.log('Creating FCM payload...');
          const payload = this.createFcmMulticastPayload(
            notification,
            [userToken.notification_token],
            senderProfile,
            addNotificationInput.postId || null,
            addNotificationInput.conversationId || null,
          );
          console.log('Created FCM payload:', JSON.stringify(payload, null, 2));

          console.log('Sending notification to Firebase...');
          const result = await this.sendNotification(payload);
          console.log('Firebase send result:', result);
        } catch (e) {
          console.error('Error in notification sending process:', e);
          console.error('Error stack:', e.stack);
          throw e; // Re-throw to see the error in the logs
        }
      } else {
        console.warn('No notification token found for user:', addNotificationInput.toId);
      }

      console.log('=== Notification Process Completed ===');
      return notification;
    } catch (error) {
      console.error('Error in addNotification:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async sendNotification(payload: MulticastMessage): Promise<boolean> {
    try {
      console.log('=== Starting Firebase Send Process ===');
      console.log('Sending notification with payload:', JSON.stringify(payload, null, 2));
      
      if (!payload?.tokens?.length) {
        console.warn('No tokens provided for notification');
        return false;
      }

      // Log token details
      console.log('Sending to tokens:', payload.tokens);
      console.log('APNs configuration:', {
        bundleId: process.env.APNS_BUNDLE_ID,
        payload: payload.apns,
      });

      console.log('Calling Firebase messaging API...');
      const response = await this.app.messaging().sendEachForMulticast({
        tokens: payload.tokens,
        notification: payload.notification,
        data: payload.data,
        android: payload.android,
        apns: payload.apns,
      });

      console.log('Firebase messaging response:', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, idx) => ({
          token: payload.tokens[idx],
          success: resp.success,
          error: resp.error,
        })),
      });
      
      if (response.failureCount > 0) {
        console.error('Some notifications failed to send:', response.responses);
      }

      console.log('=== Firebase Send Process Completed ===');
      return true;
    } catch (err) {
      console.error('Error sending notification:', err);
      console.error('Error stack:', err.stack);
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

    const apnsBundleId = process.env.APNS_BUNDLE_ID;
    if (!apnsBundleId) {
      throw new Error('APNS_BUNDLE_ID environment variable is required');
    }

    return {
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
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.message,
            },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
            'content-available': 1,
            'thread-id': BUNDLE_NOTIFICATIONS_UNIQUE_KEYS.IOS_BUNDLE_ID,
          },
          action: action,
          id: id,
          senderProfiles: senderProfiles,
          redirect_url: redirectUrl,
          notification_data: notification.data,
          test_value: 'DAYONES_NOTIF',
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-expiration': '0',
          'apns-topic': apnsBundleId,
          'apns-collapse-id': notification.id,
        },
      },
    };
  }
} 