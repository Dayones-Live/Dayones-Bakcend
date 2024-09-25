import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { cognitoJwtVerify } from 'src/modules/lib/Aws/cognito/utils/cognito.utils';

@Injectable()
export class CognitoGuard implements CanActivate {
  private readonly verifier;
  constructor() {
    this.verifier = cognitoJwtVerify();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new HttpException(`Token is Required `, HttpStatus.BAD_REQUEST);
    }

    try {
      const payload = await this.verifier.verify(token, {
        tokenUse: 'access',
        clientId: process.env.COGNITO_CLIENT_ID || '',
      });
      // You can add additional checks or modify the request object if needed
      request.userSub = payload?.username;
      return true;
    } catch (error) {
      throw new HttpException(
        `Unauthorized: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [, token] = authHeader.split(' ');
    return token || null;
  }
}
