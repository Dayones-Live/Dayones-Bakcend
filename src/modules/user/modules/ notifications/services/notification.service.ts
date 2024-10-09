import { Injectable } from '@nestjs/common';
import admin, { credential } from 'firebase-admin';

@Injectable()
/**
 * FirebaseService is responsible for handling Firebase-related operations, such as sending notifications.
 */
export class FirebaseService {
  private readonly app;

  constructor() {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    this.app = admin.initializeApp({
      credential: credential.cert(serviceAccount),
    });
  }

  /**
   * Sends a notification to the specified device tokens.
   *
   * @param deviceTokens - An array of device tokens to send the notification to.
   * @param payload - The notification payload to be sent.
   * @returns A promise that resolves to `true` if the notification is sent successfully, or `false` if an error occurs.
   */
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
