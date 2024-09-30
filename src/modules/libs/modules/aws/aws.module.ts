import { Module } from '@nestjs/common';
import { CognitoModule } from '@cognito/cognito.module';

@Module({
  imports: [CognitoModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AwsModule {}
