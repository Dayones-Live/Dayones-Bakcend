import { Controller, Post, Get, Delete, Param, Body, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { MerchService } from './merch.service';
import { MerchOrderService } from './merch-order.service';
import { CreateMerchDropDto, CreateMerchOrderDto } from './dto';

@ApiTags('Merch')
@Controller('merch')
export class MerchController {
  private readonly logger = new Logger(MerchController.name);

  constructor(
    private merchService: MerchService,
    private merchOrderService: MerchOrderService,
  ) {}

  @Post('drops')
  @Role(Roles.ARTIST)
  async createMerchDrop(@Body() dto: CreateMerchDropDto, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchService.createMerchDrop(dto.artistPostId, userId);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.MERCH_DROP_CREATED,
        data: result,
      });
    } catch (error) {
      this.logger.error(`Create drop error: ${error.message}`);
      throw error;
    }
  }

  @Get('drops/:id')
  async getMerchDrop(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.merchService.getMerchDrop(id);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('drops/post/:postId')
  async getMerchDropByPost(@Param('postId') postId: string, @Res() res: Response) {
    try {
      const result = await this.merchService.getMerchDropByPostId(postId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Delete('drops/:id')
  @Role(Roles.ARTIST)
  async cancelMerchDrop(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      await this.merchService.cancelMerchDrop(id, userId);
      res.status(HttpStatus.OK).json({ message: SUCCESS_MESSAGES.MERCH_DROP_CANCELLED });
    } catch (error) {
      throw error;
    }
  }

  @Post('orders')
  async createOrder(@Body() dto: CreateMerchOrderDto, @Req() req: Request, @Res() res: Response) {
    try {
      const fanId = req?.user?.id || '';
      const result = await this.merchOrderService.createOrder(dto, fanId);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.MERCH_ORDER_CREATED,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.merchOrderService.getOrder(id, userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }

  @Get('orders')
  async listOrders(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const userRole = req?.user?.role || [];
      const result = await this.merchOrderService.listOrders(userId, userRole);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      throw error;
    }
  }
}
