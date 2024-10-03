import { forwardRef, Module } from '@nestjs/common';
import { Server } from 'http';
import { SocketInitializer } from './socket';
import { UserModule } from '../../user.module';
import { ConversationModule } from '../chat/conversations/conversation.module';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => ConversationModule)],
  providers: [SocketInitializer],
  exports: [SocketInitializer],
})
export class SocketModule {
  constructor(private readonly socketInitializer: SocketInitializer) {}

  // Method to set the HTTP server for socket initialization
  public setHttpServer(server: Server) {
    this.socketInitializer.initializeSocket(server);
  }
}
