import { mapInputToEntity } from '@app/shared/utils';
import { AddNotificationInput } from './types';
import { Notifications } from '../entities/notifications.entity';

export class NotificationMapper {
  dtoToEntity(createNotificationInput: AddNotificationInput): Notifications {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new Notifications(),
      createNotificationInput,
      updateRecord,
    );
  }

  toDto(notification: Notifications) {
    return {
      id: notification.id,
      fromId: notification.from_id,
      toId: notification.to_id,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: notification.is_read,
      type: notification.type,
      postId: notification.post_id,
      conversationId: notification.conversation_id,
      createdAt: notification.created_at,
      updatedAt: notification.updated_at,
    };
  }
}
