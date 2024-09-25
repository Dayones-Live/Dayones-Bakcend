import { Module } from '@nestjs/common';
import { CognitoService } from './services/cognito.service';
import { CognitoController } from './controllers/cognito.controller';
import { UserModule } from 'src/modules/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [CognitoController],
  providers: [CognitoService],
  exports: [CognitoService],
})
export class CognitoModule {}
