import { Module } from '@nestjs/common';
import { CognitoService } from './services/cognito.service';
import { UserModule } from '@user/user.module';

@Module({
  imports: [UserModule],
  controllers: [],
  providers: [CognitoService],
  exports: [CognitoService],
})
export class CognitoModule {}
