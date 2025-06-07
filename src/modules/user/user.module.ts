import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { CognitoModule } from '../libs/modules/aws/cognito/cognito.module';
import { UserMapper } from './dto/user.mapper';
import { ChatModule } from './modules/chat/chat.module';
import { ArtistPostModule } from '../posts/modules/artist-post/artist-post.module';
import { ArtistPostUserModule } from '../posts/modules/artist-post-user/atrist-post-user.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { UserDevice } from './entities/user-device.entity';
import { UserDeviceService } from './services/user-device.service';
import { UserDeviceController } from './controllers/user-device.controller';
import { PushNotificationTestController } from './controllers/push-notification-test.controller';
import { SharedModule } from '@app/shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDevice]),
    forwardRef(() => CognitoModule),
    forwardRef(() => NotificationModule),
    ChatModule,
    ArtistPostModule,
    ArtistPostUserModule,
    SharedModule,
  ],
  controllers: [UserController, UserDeviceController, PushNotificationTestController],
  providers: [UserService, UserMapper, UserDeviceService],
  exports: [UserService, UserDeviceService, TypeOrmModule],
})
export class UserModule {}
