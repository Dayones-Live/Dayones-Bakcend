import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '@auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { WebhookDedupService } from '@app/shared/services/webhook-dedup.service';

@ApiTags('Stripe Webhooks')
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private stripeWebhookService: StripeWebhookService,
    private webhookDedup: WebhookDedupService,
  ) {}

  @Post('webhooks')
  @Public()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
      );

      const isNew = await this.webhookDedup.claim({
        provider: 'stripe',
        externalId: event.id,
        eventType: event.type,
      });
      if (!isNew) {
        this.logger.log(`Stripe webhook ${event.id} already processed, skipping`);
        return res.status(HttpStatus.OK).json({ received: true, deduped: true });
      }

      await this.stripeWebhookService.handleEvent(event);
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Webhook error: ${(error as Error).message}`);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: ERROR_MESSAGES.STRIPE_WEBHOOK_INVALID });
    }
  }
}
