import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { cognitoJwtVerify } from '@app/modules/libs/modules/aws/cognito/constants/cognito.constants';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { UserService } from '@app/modules/user/services/user.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
@Injectable()
export class CognitoGuard implements CanActivate {
  private readonly verifier;

  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {
    this.verifier = cognitoJwtVerify;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new HttpException(
        ERROR_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const payload = await this.verifier.verify(token, {
        tokenUse: 'access',
        clientId: process.env.COGNITO_CLIENT_ID || '',
      });
      const user = await this.userService.findUserByUserSub(payload?.username);
      // You can add additional checks or modify the request object if needed
      if (user) {
        request.userSub = payload?.username;
        request.user = user;
      }
      return true;
    } catch (error) {
      throw new HttpException(
        `Error: ${error.message}`,
        error?.status || HttpStatus.UNAUTHORIZED,
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
