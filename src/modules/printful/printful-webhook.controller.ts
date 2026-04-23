import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
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
      this.verifySignature(req);

      const { type, data } = req.body ?? {};
      if (!type) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing event type' });
      }

      await this.printfulWebhookService.handleEvent(type, data);
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn('Printful webhook rejected: invalid signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }
      this.logger.error(
        `Printful webhook handler error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Webhook processing failed' });
    }
  }

  private verifySignature(req: Request): void {
    const secret = process.env.PRINTFUL_WEBHOOK_SECRET;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('PRINTFUL_WEBHOOK_SECRET not configured in production');
        throw new InternalServerErrorException('Webhook not configured');
      }
      this.logger.warn('Webhook signature verification skipped (no secret configured, dev mode)');
      return;
    }

    const hmacHeader = req.headers['x-pf-webhook-signature'];
    if (typeof hmacHeader === 'string' && hmacHeader.length > 0) {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        throw new UnauthorizedException('Missing raw body for signature verification');
      }
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (!this.safeEquals(expected, hmacHeader)) {
        throw new UnauthorizedException('Signature mismatch');
      }
      return;
    }

    const sharedSecret = req.headers['x-printful-webhook-secret'];
    if (typeof sharedSecret !== 'string' || !this.safeEquals(sharedSecret, secret)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  private safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}
