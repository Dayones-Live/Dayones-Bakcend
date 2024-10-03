import { mapInputToEntity } from '@app/shared/utils';
import { SendMessage } from './types';
import { Message } from '../entities/message.entity';

export class MessageMapper {
  dtoToEntity(sendMessageInput: SendMessage): Message {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Message(), sendMessageInput, updateRecord);
  }
}
