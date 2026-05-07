import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app/app.config.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './shared/services/notification.module';
import { UserModule } from './modules/user/user.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { WebhookDedupModule } from './shared/services/webhook-dedup.module';

@Module({
  imports: [
    AppConfigModule,
    WebhookDedupModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 120 },
      { name: 'long', ttl: 60_000 * 60, limit: 2_000 },
    ]),
    AuthModule,
    NotificationModule,
    UserModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
