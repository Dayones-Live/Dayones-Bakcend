import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '@app/modules/user/entities/user-device.entity';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly projectId: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;
  private auth?: GoogleAuth;

  constructor(
    private configService: ConfigService,
    private userDeviceService: UserDeviceService,
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>,
  ) {
    this.projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    this.clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    this.privateKey = (
      this.configService.get<string>('FIREBASE_PRIVATE_KEY') || ''
    ).replace(/\\n/g, '\n');

    if (!this.projectId || !this.clientEmail || !this.privateKey) {
      this.logger.error('Firebase service-account credentials missing');
    } else {
      this.logger.log('FCM HTTP v1 configured');
    }
  }

  private getAuth(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({
        credentials: {
          client_email: this.clientEmail,
          private_key: this.privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
    }
    return this.auth;
  }

  async sendPushNotification(
    fcmTokens: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `[FCM_PUSH] start title="${title}" targets=${fcmTokens.length}`,
    );

    if (!this.projectId || !this.clientEmail || !this.privateKey) {
      this.logger.error('[FCM_PUSH] Missing Firebase service-account env');
      return;
    }
    if (!fcmTokens || fcmTokens.length === 0) {
      this.logger.warn('[FCM_PUSH] No active FCM tokens, skipping');
      return;
    }

    let accessToken: string;
    try {
      const client = await this.getAuth().getClient();
      const tokenResp = await client.getAccessToken();
      accessToken = tokenResp.token || '';
      if (!accessToken) throw new Error('empty access token');
    } catch (err) {
      this.logger.error(`[FCM_PUSH] Failed to get OAuth token: ${err.message}`);
      return;
    }

    // FCM HTTP v1 sends one token per request. Run them in parallel.
    const stringifiedData: Record<string, string> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== undefined) {
          stringifiedData[k] = typeof v === 'string' ? v : String(v);
        }
      }
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    const sendOne = async (token: string) => {
      try {
        await axios.post(
          endpoint,
          {
            message: {
              token,
              notification: { title, body: message },
              data: stringifiedData,
              android: { priority: 'HIGH' },
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10_000,
          },
        );
      } catch (err) {
        const code = err?.response?.data?.error?.details?.[0]?.errorCode;
        this.logger.warn(
          `[FCM_PUSH] send failed for token ${token.slice(0, 10)}...: ${err?.response?.status} ${code || err?.message}`,
        );
        if (code === 'UNREGISTERED' || err?.response?.status === 404) {
          // Best-effort: deactivate the dead token if we can find it.
          try {
            await this.userDeviceService.deactivateByFcmToken?.(token);
          } catch {
            // ignore
          }
        }
      }
    };

    await Promise.all(fcmTokens.map(sendOne));
    this.logger.log(
      `[FCM_PUSH] completed in ${Date.now() - startTime}ms`,
    );
  }
}
