import { Injectable } from '@nestjs/common';
import { initializeApp, credential } from 'firebase-admin';
import * as Account from '../../../../../../daysone-firebase-adminsdk.json';

@Injectable()
export class FirebaseService {
  private readonly app;

  constructor() {
    // Initialize Firebase app with service account
    const serviceAccount = {
      projectId: Account.project_id,
      clientEmail: Account.client_email,
      privateKey: Account.private_key.replace(/\\n/g, '\n'), // Handle newline characters
    };

    this.app = initializeApp({
      credential: credential.cert(serviceAccount),
    });
  }

  async sendNotification(
    deviceTokens: string[],
    payload: any,
  ): Promise<boolean> {
    const notificationOptions = {
      priority: 'high',
      contentAvailable: true,
    };

    try {
      if (deviceTokens.length) {
        await this.app
          .messaging()
          .sendToDevice(deviceTokens, payload, notificationOptions);
      }
      return true;
    } catch (err) {
      console.error('Error sending notification', err); // Simple error logging to console
      return false;
    }
  }
}
