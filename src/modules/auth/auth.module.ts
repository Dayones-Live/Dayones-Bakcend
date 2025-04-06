import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from '@auth/controllers/auth.controller';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { CognitoModule } from '@libs/modules/aws/cognito/cognito.module';
import { UserModule } from '@user/user.module';
import { RolesGuard } from './guards/role.guard';
import { GoogleService } from './services/google.service';

@Module({
  imports: [CognitoModule, UserModule],
  controllers: [AuthController],
  providers: [CognitoGuard, RolesGuard, GoogleService],
  exports: [CognitoGuard, RolesGuard, GoogleService],
})
export class AuthModule {}
