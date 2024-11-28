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
import { FirebaseModule } from '@app/modules/user/modules/ notifications/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CommentReactionsModule } from '@app/modules/posts/modules/comment-reactions/comment-reactions.module';
import { ReportModule } from '@app/modules/report/report.module';
import { FeedbackModule } from '@app/modules/user/modules/feedback/feedback.module';
import { BlocksModule } from '@app/modules/user/modules/blocks/blocks.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    FirebaseModule,
    CommentReactionsModule,
    ReportModule,
    FeedbackModule,
    BlocksModule,
  ],
})
export class AppConfigModule {}
