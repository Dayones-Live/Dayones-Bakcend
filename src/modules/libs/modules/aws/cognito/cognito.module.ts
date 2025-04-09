import { Module } from '@nestjs/common';
import { CognitoService } from './services/cognito.service';
import { UserService } from '@user/services/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User])
  ],
  controllers: [],
  providers: [CognitoService, UserService],
  exports: [CognitoService]
})
export class CognitoModule {}
