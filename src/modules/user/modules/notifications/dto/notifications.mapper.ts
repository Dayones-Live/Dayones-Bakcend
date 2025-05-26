import { Injectable } from '@nestjs/common';
import { Notifications } from '../entities/notifications.entity';
import { AddNotificationInput } from './types';

@Injectable()
export class NotificationMapper {
  dtoToEntity(dto: AddNotificationInput): Notifications {
    const entity = new Notifications();
    entity.from_id = dto.fromId;
    entity.to_id = dto.toId;
    entity.title = dto.title;
    entity.message = dto.message;
    entity.data = dto.data;
    entity.is_read = dto.isRead;
    entity.type = dto.type;
    return entity;
  }

  dtoToEntityUpdate(entity: Notifications, dto: AddNotificationInput): Notifications {
    entity.from_id = dto.fromId;
    entity.to_id = dto.toId;
    entity.title = dto.title;
    entity.message = dto.message;
    entity.data = dto.data;
    entity.is_read = dto.isRead;
    entity.type = dto.type;
    return entity;
  }
} 