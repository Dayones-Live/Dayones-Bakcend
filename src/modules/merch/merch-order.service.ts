import { Injectable, Logger, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MerchOrder } from './entities/merch-order.entity';
import { MerchOrderItem } from './entities/merch-order-item.entity';
import { MerchDrop } from './entities/merch-drop.entity';
import { MerchProduct } from './entities/merch-product.entity';
import { OrderLedger } from './entities/order-ledger.entity';
import { MerchOrderStatus, MerchDropStatus, LedgerStatus } from './constants';
import { StripeService } from '../stripe/stripe.service';
import { PrintfulService } from '../printful/printful.service';
import { CreateMerchOrderDto } from './dto';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';

@Injectable()
export class MerchOrderService {
  private readonly logger = new Logger(MerchOrderService.name);

  constructor(
    @InjectRepository(MerchOrder)
    private merchOrderRepo: Repository<MerchOrder>,
    @InjectRepository(MerchOrderItem)
    private merchOrderItemRepo: Repository<MerchOrderItem>,
    @InjectRepository(MerchDrop)
    private merchDropRepo: Repository<MerchDrop>,
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(OrderLedger)
    private orderLedgerRepo: Repository<OrderLedger>,
    @Inject(forwardRef(() => StripeService))
    private stripeService: StripeService,
    @Inject(forwardRef(() => PrintfulService))
    private printfulService: PrintfulService,
    @InjectQueue('order-fulfillment')
    private orderFulfillmentQueue: Queue,
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `DO-${dateStr}-${random}`;
  }

  async createOrder(dto: CreateMerchOrderDto, fanId: string) {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { id: dto.merchDropId },
        relations: ['products'],
      });

      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (drop.status !== MerchDropStatus.ACTIVE) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_ACTIVE, HttpStatus.BAD_REQUEST);
      }
      if (new Date() > drop.expires_at) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_EXPIRED, HttpStatus.BAD_REQUEST);
      }

      let subtotal = 0;
      const orderItems: Partial<MerchOrderItem>[] = [];

      for (const item of dto.items) {
        const product = drop.products.find((p) => p.id === item.merchProductId);
        if (!product) {
          throw new HttpException(ERROR_MESSAGES.MERCH_PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND);
        }
        const lineTotal = Number(product.retail_price) * item.quantity;
        subtotal += lineTotal;
        orderItems.push({
          merch_product_id: item.merchProductId,
          quantity: item.quantity,
          unit_price: Number(product.retail_price),
        });
      }

      const freeShippingThreshold = parseFloat(process.env.MERCH_FREE_SHIPPING_THRESHOLD || '95');
      let shippingCost = 0;

      if (subtotal < freeShippingThreshold) {
        try {
          const shippingRates = await this.printfulService.getShippingRates(
            {
              address1: dto.shippingAddress.address1,
              city: dto.shippingAddress.city,
              state_code: dto.shippingAddress.state_code,
              country_code: dto.shippingAddress.country_code,
              zip: dto.shippingAddress.zip,
            },
            dto.items.map((item) => {
              const product = drop.products.find((p) => p.id === item.merchProductId);
              return { catalog_variant_id: Number(product.printful_variant_id), quantity: item.quantity };
            }),
          );
          const rates = shippingRates?.data || shippingRates;
          shippingCost = parseFloat(rates?.[0]?.rate || '0');
        } catch (error) {
          this.logger.warn(`Shipping estimate failed, using 0: ${error.message}`);
        }
      }

      const total = subtotal + shippingCost;

      const order = new MerchOrder();
      order.order_number = this.generateOrderNumber();
      order.merch_drop_id = dto.merchDropId;
      order.fan_id = fanId;
      order.artist_id = drop.artist_id;
      order.status = MerchOrderStatus.PENDING;
      order.subtotal = subtotal;
      order.shipping_cost = shippingCost;
      order.total = total;
      order.shipping_address = dto.shippingAddress as any;

      const savedOrder = await this.merchOrderRepo.save(order);

      for (const item of orderItems) {
        const orderItem = new MerchOrderItem();
        orderItem.merch_order_id = savedOrder.id;
        orderItem.merch_product_id = item.merch_product_id;
        orderItem.quantity = item.quantity;
        orderItem.unit_price = item.unit_price;
        await this.merchOrderItemRepo.save(orderItem);
      }

      const paymentIntent = await this.stripeService.createPaymentIntent(total, {
        merch_order_id: savedOrder.id,
        artist_id: drop.artist_id,
        order_number: savedOrder.order_number,
      });

      savedOrder.stripe_payment_intent_id = paymentIntent.id;
      await this.merchOrderRepo.save(savedOrder);

      return {
        orderId: savedOrder.id,
        orderNumber: savedOrder.order_number,
        clientSecret: paymentIntent.client_secret,
        total,
        subtotal,
        shippingCost,
      };
    } catch (error) {
      this.logger.error(`Create order failed: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handlePaymentSucceeded(paymentIntentId: string, chargeId: string): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { stripe_payment_intent_id: paymentIntentId },
      });
      if (!order) {
        this.logger.warn(`No order found for PI: ${paymentIntentId}`);
        return;
      }
      if (order.status !== MerchOrderStatus.PENDING) {
        this.logger.warn(`Order ${order.id} already processed (status: ${order.status})`);
        return;
      }

      order.status = MerchOrderStatus.PAID;
      await this.merchOrderRepo.save(order);

      let resolvedChargeId = chargeId;
      if (!resolvedChargeId) {
        const pi = await this.stripeService.retrievePaymentIntent(paymentIntentId);
        resolvedChargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
      }
      const stripeFee = resolvedChargeId ? await this.stripeService.getBalanceTransaction(resolvedChargeId) : 0;

      const ledger = new OrderLedger();
      ledger.merch_order_id = order.id;
      ledger.gross_revenue = Number(order.total);
      ledger.stripe_fee = stripeFee;
      ledger.status = LedgerStatus.PENDING;
      await this.orderLedgerRepo.save(ledger);

      await this.orderFulfillmentQueue.add('fulfill-order', {
        merchOrderId: order.id,
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
      });
    } catch (error) {
      this.logger.error(`Handle payment succeeded failed: ${error.message}`);
    }
  }

  async handleRefund(paymentIntentId: string): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { stripe_payment_intent_id: paymentIntentId },
      });
      if (!order) return;

      order.status = MerchOrderStatus.REFUNDED;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger) {
        ledger.status = LedgerStatus.REVERSED;
        await this.orderLedgerRepo.save(ledger);
      }

      if (order.printful_order_id) {
        try {
          await this.printfulService.cancelOrder(order.printful_order_id);
        } catch (e) {
          this.logger.warn(`Could not cancel Printful order ${order.printful_order_id}: ${e.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Handle refund failed: ${error.message}`);
    }
  }

  async handleDispute(chargeId: string): Promise<void> {
    try {
      const charge = await this.stripeService.retrieveCharge(chargeId);
      const paymentIntentId = typeof charge.payment_intent === 'string'
        ? charge.payment_intent : charge.payment_intent?.id;
      if (!paymentIntentId) {
        this.logger.warn(`No PaymentIntent found for disputed charge: ${chargeId}`);
        return;
      }

      const order = await this.merchOrderRepo.findOne({
        where: { stripe_payment_intent_id: paymentIntentId },
      });
      if (!order) {
        this.logger.warn(`No order found for disputed charge: ${chargeId}`);
        return;
      }

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
        order: { created_at: 'DESC' },
      });
      if (!ledger) return;

      if (ledger.status === LedgerStatus.PENDING || ledger.status === LedgerStatus.CALCULATED) {
        ledger.status = LedgerStatus.REVERSED;
        await this.orderLedgerRepo.save(ledger);
      } else if (ledger.status === LedgerStatus.PAID_OUT) {
        const clawback = new OrderLedger();
        clawback.merch_order_id = order.id;
        clawback.gross_revenue = 0;
        clawback.stripe_fee = 0;
        clawback.printful_cost = 0;
        clawback.net_profit = -Number(ledger.net_profit);
        clawback.artist_share = -Number(ledger.artist_share);
        clawback.platform_share = -Number(ledger.platform_share);
        clawback.status = LedgerStatus.CALCULATED;
        clawback.description = `Dispute clawback for charge ${chargeId}`;
        await this.orderLedgerRepo.save(clawback);
      }

      this.logger.warn(`Dispute processed for order ${order.id}, charge ${chargeId}, ledger was ${ledger.status}`);
    } catch (error) {
      this.logger.error(`Handle dispute failed: ${error.message}`);
    }
  }

  async handleOrderFailed(printfulOrderId: number): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { printful_order_id: printfulOrderId },
      });
      if (!order) {
        this.logger.warn(`No order found for failed Printful order: ${printfulOrderId}`);
        return;
      }

      order.status = MerchOrderStatus.CANCELLED;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger && ledger.status !== LedgerStatus.REVERSED) {
        ledger.status = LedgerStatus.REVERSED;
        await this.orderLedgerRepo.save(ledger);
      }

      if (order.stripe_payment_intent_id) {
        try {
          await this.stripeService.refundPaymentIntent(order.stripe_payment_intent_id);
        } catch (refundErr) {
          this.logger.error(`Auto-refund failed for failed order ${order.id}: ${refundErr.message}`);
        }
      }

      this.logger.error(`Order ${order.id} FAILED in production (Printful ${printfulOrderId}) - auto-refund initiated`);

      try {
        const playerIds = await this.userDeviceService.getActivePlayerIds(order.artist_id);
        if (playerIds.length > 0) {
          await this.pushNotificationService.sendPushNotification(
            playerIds, 'DayOnes',
            `Order ${order.order_number} failed in production. Customer has been refunded.`,
            { type: 'order_failed', merch_order_id: order.id },
          );
        }
      } catch (notifErr) {
        this.logger.warn(`Failed order notification error: ${notifErr.message}`);
      }
    } catch (error) {
      this.logger.error(`Handle order failed error: ${error.message}`);
    }
  }

  async handleOrderCanceled(printfulOrderId: number): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { printful_order_id: printfulOrderId },
      });
      if (!order) {
        this.logger.warn(`No order found for canceled Printful order: ${printfulOrderId}`);
        return;
      }

      order.status = MerchOrderStatus.CANCELLED;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger && ledger.status !== LedgerStatus.REVERSED) {
        ledger.status = LedgerStatus.REVERSED;
        await this.orderLedgerRepo.save(ledger);
      }

      if (order.stripe_payment_intent_id) {
        try {
          await this.stripeService.refundPaymentIntent(order.stripe_payment_intent_id);
        } catch (refundErr) {
          this.logger.error(`Auto-refund failed for canceled order ${order.id}: ${refundErr.message}`);
        }
      }

      this.logger.log(`Order ${order.id} canceled (Printful ${printfulOrderId}) - refund initiated`);
    } catch (error) {
      this.logger.error(`Handle order canceled error: ${error.message}`);
    }
  }

  async getOrder(id: string, userId: string): Promise<MerchOrder> {
    const order = await this.merchOrderRepo.findOne({
      where: { id },
      relations: ['items', 'items.merchProduct', 'ledgerEntries'],
    });
    if (!order) {
      throw new HttpException(ERROR_MESSAGES.MERCH_ORDER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (order.fan_id !== userId && order.artist_id !== userId) {
      throw new HttpException(ERROR_MESSAGES.NOT_AUTHORIZED_ACTION, HttpStatus.FORBIDDEN);
    }
    return order;
  }

  async listOrders(userId: string, userRoles: Roles[]): Promise<MerchOrder[]> {
    const isArtist = userRoles.includes(Roles.ARTIST);
    const whereClause = isArtist ? { artist_id: userId } : { fan_id: userId };
    return this.merchOrderRepo.find({
      where: whereClause,
      relations: ['items', 'items.merchProduct'],
      order: { created_at: 'DESC' },
    });
  }

  async updateOrderWithPrintful(orderId: string, printfulOrderId: number): Promise<void> {
    await this.merchOrderRepo.update(orderId, {
      printful_order_id: printfulOrderId,
      status: MerchOrderStatus.PRODUCTION,
    });
  }

  async handleOrderShipped(printfulOrderId: number, trackingNumber: string, trackingUrl: string, printfulCosts: number): Promise<void> {
    try {
      const order = await this.merchOrderRepo.findOne({
        where: { printful_order_id: printfulOrderId },
      });
      if (!order) {
        this.logger.warn(`No order found for Printful order: ${printfulOrderId}`);
        return;
      }

      order.status = MerchOrderStatus.SHIPPED;
      order.tracking_number = trackingNumber;
      order.tracking_url = trackingUrl;
      await this.merchOrderRepo.save(order);

      const ledger = await this.orderLedgerRepo.findOne({
        where: { merch_order_id: order.id },
      });
      if (ledger) {
        if (Number(ledger.stripe_fee) === 0 && order.stripe_payment_intent_id) {
          try {
            const pi = await this.stripeService.retrievePaymentIntent(order.stripe_payment_intent_id);
            const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
            if (chargeId) {
              ledger.stripe_fee = await this.stripeService.getBalanceTransaction(chargeId);
            }
          } catch (e) {
            this.logger.warn(`Could not re-fetch stripe fee: ${e.message}`);
          }
        }

        const artistSplitRate = parseFloat(process.env.MERCH_ARTIST_SPLIT || '0.70');
        const platformSplitRate = parseFloat(process.env.MERCH_PLATFORM_SPLIT || '0.30');

        ledger.printful_cost = printfulCosts;
        ledger.net_profit = Number(ledger.gross_revenue) - Number(ledger.stripe_fee) - printfulCosts;

        if (ledger.net_profit < 0) {
          ledger.artist_share = 0;
          ledger.platform_share = ledger.net_profit;
        } else {
          ledger.artist_share = Math.round(ledger.net_profit * artistSplitRate * 100) / 100;
          ledger.platform_share = Math.round(ledger.net_profit * platformSplitRate * 100) / 100;
        }
        ledger.status = LedgerStatus.CALCULATED;
        await this.orderLedgerRepo.save(ledger);
      }

      try {
        const playerIds = await this.userDeviceService.getActivePlayerIds(order.fan_id);
        if (playerIds.length > 0) {
          const msg = trackingNumber
            ? `Your order ${order.order_number} has shipped! Tracking: ${trackingNumber}`
            : `Your order ${order.order_number} has shipped!`;
          await this.pushNotificationService.sendPushNotification(
            playerIds, 'DayOnes', msg,
            { type: 'order_shipped', merch_order_id: order.id, tracking_url: trackingUrl || '' },
          );
        }
      } catch (notifErr) {
        this.logger.warn(`Shipped notification failed for order ${order.id}: ${notifErr.message}`);
      }
    } catch (error) {
      this.logger.error(`Handle order shipped failed: ${error.message}`);
    }
  }

  async requestReturn(orderId: string, userId: string): Promise<MerchOrder> {
    const order = await this.merchOrderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new HttpException(ERROR_MESSAGES.MERCH_ORDER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (order.fan_id !== userId) {
      throw new HttpException(ERROR_MESSAGES.NOT_AUTHORIZED_ACTION, HttpStatus.FORBIDDEN);
    }
    if (order.status !== MerchOrderStatus.SHIPPED && order.status !== MerchOrderStatus.DELIVERED) {
      throw new HttpException('Order must be shipped or delivered to request return', HttpStatus.BAD_REQUEST);
    }
    order.status = MerchOrderStatus.RETURN_REQUESTED;
    return this.merchOrderRepo.save(order);
  }
}
