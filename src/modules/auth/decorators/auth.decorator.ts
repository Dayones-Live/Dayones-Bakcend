import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import {
  createParamDecorator,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export const Token = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
      throw new HttpException(
        ERROR_MESSAGES.ACCESS_TOKEN_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
      );
    }
    return token;
  },
);
