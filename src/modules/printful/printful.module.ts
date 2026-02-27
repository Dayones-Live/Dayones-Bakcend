import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';
import { PrintfulWebhookController } from './printful-webhook.controller';
import { PrintfulWebhookService } from './printful-webhook.service';

@Module({
  controllers: [PrintfulWebhookController],
  providers: [PrintfulService, PrintfulWebhookService],
  exports: [PrintfulService, PrintfulWebhookService],
})
export class PrintfulModule {}
