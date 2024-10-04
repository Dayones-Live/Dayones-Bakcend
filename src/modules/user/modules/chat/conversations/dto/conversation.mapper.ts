import { getCurrentUtcTime, mapInputToEntity } from '@app/shared/utils';
import { Conversations } from '../entities/conversation.entity';
import { CreateConversation, UpdateConversationInput } from './types';

export class ConversationMapper {
  /**
   * Converts a CreateConversation DTO to a Conversations entity.
   *
   * @param createConversationInput - The input DTO containing conversation creation data.
   * @returns A new Conversations entity populated with the input data.
   */
  dtoToEntity(createConversationInput: CreateConversation): Conversations {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new Conversations(),
      createConversationInput,
      updateRecord,
    );
  }

  /**
   * Updates an existing Conversations entity with new data from UpdateConversationInput.
   *
   * @param existingConvo - The existing Conversations entity to be updated.
   * @param updateConversationInput - The input DTO containing updated conversation data.
   * @returns The updated Conversations entity.
   */
  dtoToEntityUpdate(
    existingConvo: Conversations,
    updateConversationInput: UpdateConversationInput,
  ): Conversations {
    existingConvo.last_message = updateConversationInput.lastMessage;
    existingConvo.updated_at = getCurrentUtcTime();

    return existingConvo;
  }
}
