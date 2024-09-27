import { Module } from '@nestjs/common';
import { NestConfigModule } from '../nest/nest.config.module';
import { AuthModule } from '@auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerHealthCheckModule } from 'src/modules/server-health-check/server-health-check.module';
import databaseConfig from '../database/postgres/orm.config';
import { UserModule } from 'src/modules/user/user.module';
import { UserNotificationModule } from 'src/modules/user/modules/user-notifications/user-notification.module';
import { LibsModule } from '@app/modules/libs/libs.module';
import { SignatureModule } from '@app/modules/user/modules/signatures/signatures.module';
import { PostModule } from '@app/modules/posts/post.module';

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
  ],
})
export class AppConfigModule {}
