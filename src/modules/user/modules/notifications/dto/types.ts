import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { NOTIFICATION_TYPE } from '../entities/notifications.entity';

export class AddNotificationInput {
  @IsNotEmpty()
  @IsUUID()
  fromId: string;

  @IsNotEmpty()
  @IsUUID()
  toId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsNotEmpty()
  isRead: boolean;

  @IsNotEmpty()
  type: NOTIFICATION_TYPE;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
} 