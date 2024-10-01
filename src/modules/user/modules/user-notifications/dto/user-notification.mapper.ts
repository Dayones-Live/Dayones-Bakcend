import { mapInputToEntity } from '@app/shared/utils';
import { UpsertUserNotificationInput } from './types';
import { UserNotification } from '../entities/user-notifications.entity';

export class UserNotificationMapper {
  dtoToEntity(
    upsertUserNotificationInput: UpsertUserNotificationInput,
  ): UserNotification {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new UserNotification(),
      upsertUserNotificationInput,
      updateRecord,
    );
  }

  dtoToEntityUpdate(
    existingUserNotification: UserNotification,
    updateUserNotification: UpsertUserNotificationInput,
  ): UserNotification {
    const updateRecord: boolean = true;
    return mapInputToEntity(
      existingUserNotification,
      updateUserNotification,
      updateRecord,
    );
  }
}
