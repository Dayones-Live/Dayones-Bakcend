import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/Auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerHealthCheckModule } from 'src/modules/server-health-check/server-health-check.module';
import databaseConfig from '../database/postgres/orm.config';
import { CognitoModule } from 'src/modules/lib/Aws/cognito/cognito.module';
import { UserModule } from 'src/modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ServerHealthCheckModule,
    AuthModule,
    CognitoModule,
    UserModule,
  ],
})
export class AppConfigModule {}
