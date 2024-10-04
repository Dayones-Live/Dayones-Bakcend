import { Server } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { UserService } from '@app/modules/user/services/user.service';
import { Message } from '@app/modules/user/modules/chat/messages/entities/message.entity';
import { ConversationService } from '@app/modules/user/modules/chat/conversations/services/conversation.service';
import { cognitoJwtVerify } from '@app/modules/libs/modules/aws/cognito/constants/cognito.constants';

@Injectable()
export class SocketInitializer {
  private usersMap: Map<string, Map<string, Socket>> = new Map();
  private io: SocketServer;
  private readonly verifier;

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
  ) {
    this.verifier = cognitoJwtVerify;
  }

  /**
   * Initializes the socket server and sets up the connection handler.
   *
   * @param server - The HTTP server instance to attach the socket server to.
   */
  initializeSocket(server: Server) {
    this.io = new SocketServer(server);
    this.io.on('connect', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handles the connection of a socket client.
   *
   * This method authenticates the user, verifies their membership in the specified conversation,
   * and adds the socket to the user's conversation map.
   *
   * @param socket - The Socket instance representing the client connection.
   * @throws {Error} Throws an error if the token is invalid, the conversation is invalid,
   *                 or if the token or conversation ID are missing.
   * @returns {Promise<void>} A promise that resolves when the connection is handled successfully.
   */
  private async handleConnection(socket: Socket): Promise<void> {
    try {
      const { token, conversationId } = socket.handshake.auth;

      if (token && conversationId) {
        const payload = await this.verifier.verify(token, {
          tokenUse: 'access',
          clientId: process.env.COGNITO_CLIENT_ID || '',
        });

        if (!payload) {
          throw new Error('Invalid Token');
        }
        const user = await this.userService.findUserByUserSub(payload.username);
        if (!user) {
          throw new Error('Invalid Token');
        }

        const conversationMember =
          await this.conversationService.isMemberOfConversation(
            conversationId.toString(),
            user.id.toString(),
          );
        if (conversationMember?.id) {
          const conversationMap =
            this.usersMap.get(user.id.toString()) || new Map();
          conversationMap.set(conversationId.toString(), socket);
          this.usersMap.set(user.id.toString(), conversationMap);
          console.log('usersMap', this.usersMap);
        } else {
          throw new Error('Invalid conversation');
        }
      } else {
        throw new Error('Token or conversation ID not found');
      }
    } catch (err) {
      const error = err as Error;
      socket.emit('error', error.message || 'Unknown error');
    }
  }

  /**
   * Sends a socket message to a specific user in a specific conversation.
   *
   * @param userId - The ID of the user to send the message to.
   * @param conversationId - The ID of the conversation the message belongs to.
   * @param message - An object containing the Message entity to be sent.
   * @returns {Promise<void>} A promise that resolves when the message is sent or if the socket is not found.
   */
  async sendSocketMessage(
    userId: string,
    conversationId: string,
    message: { message: Message },
  ): Promise<void> {
    const socketMap = this.usersMap.get(userId.toString());
    if (socketMap) {
      const socket = socketMap.get(conversationId.toString());
      if (socket) {
        socket.emit('chat-message', message);
      }
    }
  }

  /**
   * Disconnects a user from all conversations and removes their entry from the users map.
   *
   * @param userId - The ID of the user to disconnect.
   * @returns {Promise<void>} A promise that resolves when the user is disconnected and removed from the map.
   */
  async disconnect(userId: string): Promise<void> {
    const map = this.usersMap.get(userId.toString());
    if (map && map.size > 0) {
      this.usersMap.delete(userId.toString());
    }
  }
}
