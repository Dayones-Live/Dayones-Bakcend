import { Module } from '@nestjs/common';
import { CognitoGuard } from './guards/aws.cognito.guard';
import { AuthController } from './controllers/auth.controller';
import { CognitoModule } from '../lib/Aws/cognito/cognito.module';
import { CognitoService } from '../lib/Aws/cognito/services/cognito.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [CognitoModule, UserModule],
  controllers: [AuthController],
  providers: [CognitoService, CognitoGuard],
  exports: [CognitoService, CognitoGuard],
})
export class AuthModule {}
