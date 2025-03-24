import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginate, PaginationDto } from '@app/types';
import { ConversationMapper } from '../dto/conversation.mapper';
import { Conversations } from '../entities/conversation.entity';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AllConversationResponse,
  CreateConversationInput,
  UpdateConversationInput,
} from '../dto/types';
import { MessageService } from '../../messages/services/message.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversations)
    private conversationRepository: Repository<Conversations>,
    private conversationMapper: ConversationMapper,
    private messageService: MessageService,
  ) {}

  /**
   * Creates a new conversation between users.
   *
   * This function creates a new conversation entry in the database. It's designed
   * to be used only by users with the 'ARTIST' role. The function validates the
   * user's role, creates a conversation DTO, and saves it to the repository.
   *
   * @param userId - The ID of the user initiating the conversation (the sender).
   * @param role - An array of roles associated with the user. The first role is checked
   *               to ensure it's 'ARTIST'.
   * @param req - An object containing the details for creating the conversation.
   *              It includes the last message and the receiver's ID.
   *
   * @returns A Promise that resolves to the newly created Conversations entity.
   *
   * @throws {HttpException} Throws an HTTP exception with BAD_REQUEST status if:
   *         - The user's role is not 'ARTIST'.
   *         - Any error occurs during the conversation creation process.
   */
  async createConversation(
    userId: string,
    req: CreateConversationInput,
  ): Promise<Conversations> {
    try {
      const { lastMessage, recieverId, mediaType, url } = req;
      const dto = this.conversationMapper.dtoToEntity({
        lastMessage: lastMessage || (mediaType ? `[${mediaType}]` : ''),
        recieverId,
        senderId: userId,
        senderRecieverCode: `${userId}_${recieverId}`,
      });
      const conversation = await this.conversationRepository.save(dto);

      if (lastMessage || mediaType) {
        await this.messageService.sendMessage(
          {
            conversationId: conversation.id,
            message: lastMessage,
            mediaType: mediaType,
            url: url,
          },
          userId,
        );
      }
      return conversation;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Fetches all conversations for a given user with pagination support.
   *
   * This function retrieves conversations where the specified user is either
   * the sender or the receiver. The results are paginated based on the provided
   * pagination parameters.
   *
   * @param req - The pagination parameters for the request.
   * @param user_id - The ID of the user whose conversations are being fetched.
   * @returns A Promise that resolves to an object containing the list of conversations
   *          and metadata about the pagination.
   * @throws {HttpException} Throws an HTTP exception with BAD_REQUEST status if fetching fails.
   */
  async fetchAllConversations(
    req: PaginationDto,
    user_id: string,
  ): Promise<AllConversationResponse> {
    const paginate: Paginate = getPaginated(req.pageNo || 1, req.pageSize || 0);

    try {
      const [conversations, count] =
        await this.conversationRepository.findAndCount({
          where: [{ sender_id: user_id }, { reciever_id: user_id }],
          skip: paginate.offset,
          take: paginate.limit,
          relations: ['sender', 'reciever'],
        });

      const meta = getPaginatedOutput(
        paginate.pageNo,
        paginate.pageSize,
        count,
      );

      return {
        conversations,
        meta,
      };
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Updates an existing conversation with new information.
   *
   * This function attempts to update a conversation in the database. It first checks
   * if the conversation exists, then applies the updates, and finally saves the
   * updated conversation.
   *
   * @param req - The input containing the update information for the conversation.
   *              This includes the conversation ID and any fields to be updated.
   *
   * @returns A Promise that resolves to the updated Conversations entity.
   *
   * @throws {HttpException} Throws an HTTP exception with NOT_FOUND status if the
   *         conversation with the given ID does not exist in the database.
   */
  async updateConversation(
    req: UpdateConversationInput,
  ): Promise<Conversations> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: req.id },
    });

    if (!conversation) {
      throw new HttpException(
        ERROR_MESSAGES.CONVERSATION_DONT_EXIST,
        HttpStatus.NOT_FOUND,
      );
    }

    const dto = this.conversationMapper.dtoToEntityUpdate(conversation, req);
    const updatedConversation = await this.conversationRepository.save(dto);

    return updatedConversation;
  }

  /**
   * Deletes a conversation and its associated messages from the database.
   *
   * This function attempts to delete a conversation by its ID. It first checks if the
   * conversation exists, then deletes all associated messages, and finally removes
   * the conversation itself from the database.
   *
   * @param id - The unique identifier of the conversation to be deleted.
   *
   * @returns A Promise that resolves to a boolean:
   *          - true if the conversation was successfully deleted
   *          - false if the deletion operation did not affect any rows
   *
   * @throws {HttpException} Throws an HTTP exception with NOT_FOUND status if the
   *         conversation with the given ID does not exist in the database.
   * @throws {HttpException} Throws an HTTP exception with BAD_REQUEST status if any
   *         other error occurs during the deletion process.
   */
  async deleteConversation(id: string): Promise<boolean> {
    try {
      const conversation = await this.conversationRepository.findOne({
        where: { id: id },
      });

      if (!conversation) {
        throw new HttpException(
          ERROR_MESSAGES.CONVERSATION_DONT_EXIST,
          HttpStatus.NOT_FOUND,
        );
      }

      await this.messageService.deleteAllMessagesByConversationId(
        conversation.id,
      );
      const deleteResult = await this.conversationRepository.delete({
        id: id,
      });

      return deleteResult.affected ? true : false;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Checks if a user is a member of a specific conversation.
   *
   * This function verifies whether the given user is either the sender or receiver
   * in the specified conversation.
   *
   * @param conversationId - The unique identifier of the conversation to check.
   * @param userId - The unique identifier of the user to verify membership for.
   * @returns A Promise that resolves to a boolean:
   *          - true if the user is a member of the conversation
   *          - false if the user is not a member of the conversation
   */
  async isMemberOfConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversations | null> {
    const conversation = await this.conversationRepository.findOne({
      where: [
        { id: conversationId, sender_id: userId },
        { id: conversationId, reciever_id: userId },
      ],
    });

    return conversation;
  }

  /**
   * Retrieves detailed information about a specific conversation for a given user.
   *
   * This function fetches a conversation by its ID, ensuring that the specified user
   * is either the sender or receiver of the conversation. It includes related entities
   * such as sender, receiver, and messages in the returned data.
   *
   * @param conversationId - The unique identifier of the conversation to retrieve.
   * @param userId - The ID of the user requesting the conversation details.
   *                 This user must be either the sender or receiver of the conversation.
   *
   * @returns A Promise that resolves to the Conversations entity with related data.
   *
   * @throws {HttpException} Throws an HTTP exception with NOT_FOUND status if the
   *         conversation doesn't exist or the user is not a participant.
   * @throws {HttpException} Throws an HTTP exception with BAD_REQUEST status if any
   *         other error occurs during the retrieval process.
   */
  async getConversationDetails(
    conversationId: string,
    userId: string,
  ): Promise<Conversations> {
    try {
      const conversation = await this.conversationRepository.findOne({
        where: [
          { id: conversationId, sender_id: userId },
          { id: conversationId, reciever_id: userId },
        ],
        relations: ['sender', 'reciever', 'message'],
      });

      if (!conversation) {
        throw new HttpException(
          ERROR_MESSAGES.CONVERSATION_DONT_EXIST,
          HttpStatus.NOT_FOUND,
        );
      }
      return conversation;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }
}
