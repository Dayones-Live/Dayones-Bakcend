import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { CognitoModule } from '../libs/modules/aws/cognito/cognito.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => CognitoModule)],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
