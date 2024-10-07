import { User } from '@app/modules/user/entities/user.entity';
import { Request } from 'express';

declare module 'express' {
  interface Request {
    userSub?: string;
    user?: User; // You can replace `any` with the actual user type if you know it
  }
}
