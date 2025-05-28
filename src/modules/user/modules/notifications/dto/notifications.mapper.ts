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
}
