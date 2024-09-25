import { Module } from '@nestjs/common';
import { CognitoGuard } from './guards/aws.cognito.guard';
import { AuthController } from './controllers/auth.controller';
import { CognitoModule } from '../lib/Aws/cognito/cognito.module';

@Module({
  imports: [CognitoModule],
  controllers: [AuthController],
  providers: [CognitoGuard],
  exports: [CognitoGuard],
})
export class AuthModule {}
