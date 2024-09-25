import { Request } from 'express';

declare module 'express' {
  interface Request {
    user_sub?: string; // You can replace `any` with the actual user type if you know it
  }
}
