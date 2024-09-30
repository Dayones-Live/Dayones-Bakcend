import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class UpsertUserNotificationInput {
  @IsOptional()
  @IsUUID()
  userId: string;

  @IsNotEmpty({ message: 'Notification Token is required' })
  notificationToken: string;
}
