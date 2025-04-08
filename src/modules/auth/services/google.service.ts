import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { CognitoService } from '@aws/cognito/services/cognito.service';
import { UserService } from '@user/services/user.service';
import { Roles } from '@app/shared/constants/constants';

@Injectable()
export class GoogleService {
  private client: OAuth2Client;

  constructor(
    private configService: ConfigService,
    private cognitoService: CognitoService,
    private userService: UserService,
  ) {
    this.client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async verifyIdToken(idToken: string) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new Error('Invalid token payload');
      }

      // Try to find the user by email
      let user;
      try {
        user = await this.userService.findUserByUserSub(payload.email);
        
        // Only update avatar if user doesn't have one
        if (!user.avatar_url) {
          const updateResponse = await this.userService.updateUser({
            avatarUrl: payload.picture
          }, user.id);
          user = updateResponse.data;
        }
      } catch (error) {
        // If user is not found, that's fine - we'll just return the Google user info
        return {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          sub: payload.sub,
          user: null
        };
      }

      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
        user: {
          ...user,
          role: user?.role?.[0] || null
        }
      };
    } catch (error) {
      throw new Error(`Google token verification failed: ${error.message}`);
    }
  }
} 