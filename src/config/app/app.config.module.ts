import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import databaseConfig from '../database/postgres/orm.config';
import { NestConfigModule } from '../nest/nest.config.module';
import { AuthModule } from '@auth/auth.module';

import { ServerHealthCheckModule } from 'src/modules/server-health-check/server-health-check.module';
import { UserModule } from 'src/modules/user/user.module';
import { UserNotificationModule } from '@user-notifications/user-notification.module';
import { LibsModule } from '@app/modules/libs/libs.module';
import { SignatureModule } from '@app/modules/user/modules/signatures/signatures.module';
import { PostModule } from '@app/modules/posts/post.module';
import { ChatModule } from '@app/modules/user/modules/chat/chat.module';
import { SocketModule } from '@app/modules/user/modules/socket/socket.module';

@Module({
  imports: [
    NestConfigModule,
    TypeOrmModule.forRoot(databaseConfig),
    ServerHealthCheckModule,
    AuthModule,
    LibsModule,
    UserModule,
    UserNotificationModule,
    SignatureModule,
    PostModule,
    ChatModule,
    SocketModule,
  ],
})
export class AppConfigModule {}
