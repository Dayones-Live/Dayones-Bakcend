import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

@Injectable()
export class GoogleService {
  private readonly clientId: string;
  private readonly extraAudiences: string[];
  private readonly client: OAuth2Client;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const extras = this.configService.get<string>('GOOGLE_CLIENT_IDS') || '';
    this.extraAudiences = extras
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    this.client = new OAuth2Client(this.clientId);
  }

  async verifyToken(idToken: string): Promise<GoogleProfile> {
    if (!idToken) {
      throw new HttpException('idToken is required', HttpStatus.BAD_REQUEST);
    }
    const audiences =
      this.extraAudiences.length > 0
        ? [this.clientId, ...this.extraAudiences].filter(Boolean)
        : this.clientId;
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: audiences,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new HttpException(
        `Invalid Google token: ${error?.message || 'verification failed'}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!payload?.email || !payload?.sub) {
      throw new HttpException(
        'Google token payload missing email or sub',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture,
      sub: payload.sub,
    };
  }
}
