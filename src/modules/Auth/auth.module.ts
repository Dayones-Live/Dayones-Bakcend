import { Module } from '@nestjs/common';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { AuthController } from '@auth/controllers/auth.controller';
import { CognitoModule } from '../libs/modules/aws/cognito/cognito.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [CognitoModule, UserModule],
  controllers: [AuthController],
  providers: [CognitoGuard],
  exports: [CognitoGuard],
})
export class AuthModule {}
