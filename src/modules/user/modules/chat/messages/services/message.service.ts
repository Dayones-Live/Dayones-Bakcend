import { Repository } from 'typeorm';
import { Paginate } from '@app/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { MessageMapper } from '../dto/message.mapper';
import { SocketInitializer } from '@app/modules/user/modules/socket/socket';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConversationService } from '@app/modules/user/modules/chat/conversations/services/conversation.service';
import {
  SendMessageInput,
  GetAllMessagesDto,
  AllMessageResponse,
} from '../dto/types';
import { FirebaseService } from '@app/modules/user/modules/notifications/services/notification.service';
import {
  NOTIFICATION_TITLE,
  NOTIFICATION_TYPE,
} from '@app/modules/user/modules/notifications/constants';
import { BlocksService } from '@app/modules/user/modules/blocks/services/blocks.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private messageMapper: MessageMapper,
    private socketInitializer: SocketInitializer,
    @Inject(forwardRef(() => ConversationService))
    private conversationService: ConversationService,
    @Inject(forwardRef(() => FirebaseService)) private firebaseService: FirebaseService,
    private blockService: BlocksService,
  ) {}

  /**
   * Disconnects the socket connection for a specific user.
   *
   * @param {string} userId - The ID of the user whose socket should be disconnected.
   * @returns {Promise<boolean>} A promise that resolves to true if the socket was successfully disconnected.
   * @throws {HttpException} Throws a BAD_REQUEST error if the disconnection fails.
   */
  async disconnectSocket(userId: string): Promise<boolean> {
    try {
      this.socketInitializer.disconnect(userId);
      return true;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Sends a message through sockets to the specified users.
   *
   * @param {string[]} userIds - An array of user IDs to send the message to.
   * @param {string} conversationId - The ID of the conversation where the message is being sent.
   * @param {Message} message - The message object to be sent.
   * @returns {Promise<{ success: boolean; error?: string }>} A promise that resolves to an object indicating success or error.
   */
  async sendMessageThroughSocket(
    userIds: string[],
    conversationId: string,
    message: Message,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      for (const userId of userIds) {
        await this.socketInitializer.sendSocketMessage(userId, conversationId, {
          message,
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Sends a message after validating the user's membership in the conversation.
   *
   * @param {SendMessageInput} req - The input data for sending a message.
   * @param {string} userId - The ID of the user sending the message.
   * @returns {Promise<Message>} A promise that resolves to the created Message entity.
   * @throws {HttpException} Throws an error if the user is not a member of the conversation or if message creation fails.
   */
  async sendMessage(req: SendMessageInput, userId: string): Promise<Message> {
    try {
      const isMember = await this.conversationService.isMemberOfConversation(
        req.conversationId,
        userId,
      );
      if (!isMember) {
        throw new HttpException(
          ` ${ERROR_MESSAGES.NOT_AUTHORIZED_ACTION}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const blockStatus = await this.blockService.checkBlockStatus(
        userId,
        userId === isMember.sender_id
          ? isMember.reciever_id
          : isMember.sender_id,
      );

      if (blockStatus) {
        throw new HttpException(
          ` ${ERROR_MESSAGES.BLOCKED_USER}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const message = await this.messageRepository.save(
        this.messageMapper.dtoToEntity({ ...req, senderId: userId }),
      );

      if (message) {
        await this.conversationService.updateConversation({
          id: req.conversationId,
          lastMessage: message.message || `[${message.media_type}]`,
        });

        await this.sendMessageThroughSocket(
          [isMember.sender_id, isMember.reciever_id],
          message.conversation_id,
          message,
        );
      }

      // get receiver id
      const toId =
        isMember?.sender_id === userId
          ? isMember?.reciever_id
          : isMember?.sender_id;

      try {
        console.log('Attempting to send message notification...');
        console.log('Notification details:', {
          toId,
          fromId: userId,
          message: req?.message || `[${req?.mediaType}]`,
          conversationId: req.conversationId
        });

        await this.firebaseService.addNotification({
          toId: toId,
          isRead: false,
          fromId: userId,
          title: NOTIFICATION_TITLE.MESSAGE,
          data: JSON.stringify({
            message: req?.message || `[${req?.mediaType}]`,
            conversation_id: req.conversationId
          }),
          message: req?.message || `[${req?.mediaType}]`,
          type: NOTIFICATION_TYPE.MESSAGE,
          conversationId: req.conversationId,
        });
        console.log('Message notification sent successfully');
      } catch (err) {
        console.error('🚀 ~ Error sending message notification:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack
        });
      }

      return message;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Retrieves messages by conversation ID with pagination.
   *
   * @param {GetAllMessagesDto} req - The request DTO containing pagination information and conversation ID.
   * @returns {Promise<AllMessageResponse>} A promise that resolves to an object containing messages and pagination metadata.
   * @throws {HttpException} Throws an error if message retrieval fails.
   */
  async getMessagesByConversationId(
    req: GetAllMessagesDto,
  ): Promise<AllMessageResponse> {
    const paginate: Paginate = getPaginated(req.pageNo || 1, req.pageSize || 0);
    try {
      const [messages, count] = await this.messageRepository.findAndCount({
        where: [{ conversation_id: req.conversationId }],
        skip: paginate.offset,
        take: paginate.limit,
        relations: ['messageSender'],
      });

      const meta = getPaginatedOutput(
        paginate.pageNo,
        paginate.pageSize,
        count,
      );

      return {
        messages,
        meta,
      };
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Deletes a message by its ID after verifying the sender's identity.
   *
   * @param {string} messageId - The ID of the message to be deleted.
   * @param {string} userId - The ID of the user attempting to delete the message.
   * @returns {Promise<boolean>} A promise that resolves to true if the message was successfully deleted.
   * @throws {HttpException} Throws an error if the message is not found or the user is not authorized to delete it.
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const message = await this.messageRepository.findOne({
        where: {
          id: messageId,
        },
      });
      if (!message) {
        throw new HttpException(
          ERROR_MESSAGES.MESSAGE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (message.sender_id !== userId) {
        throw new HttpException(
          ERROR_MESSAGES.NOT_AUTHORIZED_ACTION,
          HttpStatus.UNAUTHORIZED,
        );
      }

      const deletedMessage = await this.messageRepository.delete(message.id);

      return deletedMessage.affected ? true : false;
    } catch (error) {
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Deletes all messages associated with a specific conversation.
   *
   * This function retrieves all messages for a given conversation ID,
   * extracts their IDs, and then deletes them from the repository.
   *
   * @param {string} conversationId - The unique identifier of the conversation
   *                                  whose messages are to be deleted.
   * @returns {Promise<boolean>} A promise that resolves to:
   *                             - true if one or more messages were deleted
   *                             - false if no messages were deleted or if the deletion failed
   */
  async deleteAllMessagesByConversationId(
    conversationId: string,
  ): Promise<boolean> {
    const messages = await this.messageRepository.find({
      where: {
        conversation_id: conversationId,
      },
    });

    const messageIds = messages.map((message) => message.id);

    const deletedMessage = await this.messageRepository.delete(messageIds);

    return deletedMessage.affected ? true : false;
  }
}
