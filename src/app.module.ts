import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app/app.config.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './shared/services/notification.module';

@Module({
  imports: [AppConfigModule, AuthModule, NotificationModule],
})
export class AppModule {}
