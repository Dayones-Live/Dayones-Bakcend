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
    // Initialize Firebase app with service account
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    this.app = admin.initializeApp({
      credential: credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    // Configure APNs
    if (!process.env.APNS_BUNDLE_ID) {
      throw new Error('APNS_BUNDLE_ID environment variable is required');
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
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-expiration': '0',
          'apns-topic': apnsBundleId,
        },
      },
    };
  }
} 