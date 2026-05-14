import { ApiHideProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class UpsertUserNotificationInput {
  @ApiHideProperty()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsNotEmpty({ message: 'Notification Token is required' })
  notificationToken: string;
}
