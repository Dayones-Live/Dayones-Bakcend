import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app/app.config.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [AppConfigModule, AuthModule],
})
export class AppModule {}
