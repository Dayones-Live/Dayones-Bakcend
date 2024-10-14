import { Module } from '@nestjs/common';
import { CognitoModule } from '@cognito/cognito.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [CognitoModule, S3Module],
  controllers: [],
  providers: [],
  exports: [],
})
export class AwsModule {}
