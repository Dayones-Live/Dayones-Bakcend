import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '@auth/decorators/public.decorator';
import { PrintfulWebhookService } from './printful-webhook.service';

@ApiTags('Printful Webhooks')
@Controller('printful')
export class PrintfulWebhookController {
  private readonly logger = new Logger(PrintfulWebhookController.name);

  constructor(private printfulWebhookService: PrintfulWebhookService) {}

  @Post('webhooks')
  @Public()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    try {
      const webhookSecret = req.headers['x-printful-webhook-secret'];
      if (webhookSecret !== process.env.PRINTFUL_WEBHOOK_SECRET) {
        this.logger.warn('Invalid Printful webhook secret');
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ error: 'Invalid webhook secret' });
      }

      const { type, data } = req.body;
      await this.printfulWebhookService.handleEvent(type, data);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Printful webhook error: ${error.message}`);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  }
}
