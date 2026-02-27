import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import databaseConfig from '../database/postgres/orm.config';
import { NestConfigModule } from '../nest/nest.config.module';
import { AuthModule } from '@auth/auth.module';

import { ServerHealthCheckModule } from 'src/modules/server-health-check/server-health-check.module';
import { UserModule } from 'src/modules/user/user.module';
import { UserNotificationModule } from '@app/modules/user/modules/user-notifications/user-notification.module';
import { LibsModule } from '@app/modules/libs/libs.module';
import { SignatureModule } from '@app/modules/user/modules/signatures/signatures.module';
import { PostModule } from '@app/modules/posts/post.module';
import { ChatModule } from '@app/modules/user/modules/chat/chat.module';
import { SocketModule } from '@app/modules/user/modules/socket/socket.module';
import { NotificationModule } from '@app/modules/user/modules/notifications/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CommentReactionsModule } from '@app/modules/posts/modules/comment-reactions/comment-reactions.module';
import { ReportModule } from '@app/modules/report/report.module';
import { FeedbackModule } from '@app/modules/user/modules/feedback/feedback.module';
import { BlocksModule } from '@app/modules/user/modules/blocks/blocks.module';
import { StripeModule } from '@app/modules/stripe/stripe.module';
import { PrintfulModule } from '@app/modules/printful/printful.module';
import { MerchModule } from '@app/modules/merch/merch.module';

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
    NotificationModule,
    CommentReactionsModule,
    ReportModule,
    FeedbackModule,
    BlocksModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    StripeModule,
    PrintfulModule,
    MerchModule,
  ],
})
export class AppConfigModule {}
