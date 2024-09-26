import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class UpsertUserNotificationInput {
  @IsOptional()
  @IsUUID()
  user_id: string;

  @IsNotEmpty({ message: 'Notification Token is required' })
  notification_token: string;
}
