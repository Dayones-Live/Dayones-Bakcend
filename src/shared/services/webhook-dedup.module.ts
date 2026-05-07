import { Global, Module } from '@nestjs/common';
import { WebhookDedupService } from './webhook-dedup.service';

@Global()
@Module({
  providers: [WebhookDedupService],
  exports: [WebhookDedupService],
})
export class WebhookDedupModule {}
