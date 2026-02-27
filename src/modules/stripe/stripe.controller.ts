import { Controller, Post, Get, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { StripeService } from './stripe.service';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private stripeService: StripeService) {}

  @Post('connect/onboard')
  @Role(Roles.ARTIST)
  async createConnectAccount(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const email = req?.user?.email || '';
      const result = await this.stripeService.createConnectAccount(userId, email);
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.STRIPE_ONBOARD_SUCCESS,
        data: result,
      });
    } catch (error) {
      this.logger.error(`Onboard error: ${error.message}`);
      throw error;
    }
  }

  @Get('connect/status')
  @Role(Roles.ARTIST)
  async getConnectStatus(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.stripeService.getConnectStatus(userId);
      res.status(HttpStatus.OK).json({
        message: 'Stripe Connect status retrieved',
        data: result,
      });
    } catch (error) {
      this.logger.error(`Status error: ${error.message}`);
      throw error;
    }
  }
}
