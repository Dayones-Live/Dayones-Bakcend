import { Request } from 'express';

declare module 'express' {
  interface Request {
    userSub?: string; // You can replace `any` with the actual user type if you know it
  }
}
