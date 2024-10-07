import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from '@auth/controllers/auth.controller';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { CognitoModule } from '@libs/modules/aws/cognito/cognito.module';
import { UserModule } from '@user/user.module';
import { RolesGuard } from './guards/role.guard';

@Module({
  imports: [CognitoModule, UserModule],
  controllers: [AuthController],
  providers: [CognitoGuard, RolesGuard],
  exports: [CognitoGuard, RolesGuard],
})
export class AuthModule {}
