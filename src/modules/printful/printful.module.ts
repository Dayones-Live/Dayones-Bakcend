import { Module } from '@nestjs/common';
import { PrintfulService } from './printful.service';
import { PrintfulCatalogService } from './printful-catalog.service';
import { PrintfulWebhookController } from './printful-webhook.controller';
import { PrintfulWebhookService } from './printful-webhook.service';

@Module({
  controllers: [PrintfulWebhookController],
  providers: [PrintfulService, PrintfulCatalogService, PrintfulWebhookService],
  exports: [PrintfulService, PrintfulCatalogService, PrintfulWebhookService],
})
export class PrintfulModule {}
