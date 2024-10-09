import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { NOTIFICATION_TYPE } from '../constants';

export class AddNotificationInput {
  @IsNotEmpty({ message: 'From Id is required' })
  fromId: string;

  @IsNotEmpty({ message: 'To Id is required' })
  toId: string;

  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @IsNotEmpty({ message: 'data is required' })
  data: string;

  @IsNotEmpty({ message: 'data is required' })
  isRead: boolean;

  @IsEnum(NOTIFICATION_TYPE, { message: 'Role must be one of:  USER, ARTIST' })
  type: NOTIFICATION_TYPE;
}
