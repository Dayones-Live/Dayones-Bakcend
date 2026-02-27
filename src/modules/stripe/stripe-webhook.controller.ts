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

@ApiTags('Stripe Webhooks')
@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private stripeWebhookService: StripeWebhookService,
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
      await this.stripeWebhookService.handleEvent(event);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: ERROR_MESSAGES.STRIPE_WEBHOOK_INVALID });
    }
  }
}
