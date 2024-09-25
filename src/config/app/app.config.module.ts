import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerHealthCheckModule } from 'src/modules/server-health-check/server-health-check.module';
import databaseConfig from '../database/postgres/orm.config';
import { UserModule } from 'src/modules/user/user.module';
import { AwsModule } from 'src/modules/lib/Aws/aws.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ServerHealthCheckModule,
    AuthModule,
    AwsModule,
    UserModule,
  ],
})
export class AppConfigModule {}
