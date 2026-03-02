import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrintfulWebhookService {
  private readonly logger = new Logger(PrintfulWebhookService.name);
  private merchOrderService: any = null;

  setMerchOrderService(service: any): void {
    this.merchOrderService = service;
  }

  async handleEvent(eventType: string, data: any): Promise<void> {
    switch (eventType) {
      case 'order_created':
        this.logger.log(`Printful order created: ${data.order?.id}`);
        break;
      case 'order_updated':
        await this.handleOrderUpdated(data);
        break;
      case 'package_shipped':
        await this.handleOrderShipped(data);
        break;
      case 'order_canceled':
        await this.handleOrderCanceled(data);
        break;
      case 'order_failed':
        await this.handleOrderFailed(data);
        break;
      default:
        this.logger.log(`Unhandled Printful event: ${eventType}`);
    }
  }

  private async handleOrderUpdated(data: any): Promise<void> {
    this.logger.log(`Printful order updated: ${data.order?.id}`);
  }

  private async handleOrderShipped(data: any): Promise<void> {
    this.logger.log(`Printful order shipped: ${data.order?.id}`);
    if (this.merchOrderService) {
      const order = data.order;
      const shipment = data.shipment || order?.shipments?.[0];
      const totalCosts = order?.costs?.total
        ? parseFloat(order.costs.total)
        : 0;
      await this.merchOrderService.handleOrderShipped(
        order.id,
        shipment?.tracking_number || '',
        shipment?.tracking_url || '',
        totalCosts,
      );
    }
  }

  private async handleOrderCanceled(data: any): Promise<void> {
    this.logger.log(`Printful order canceled: ${data.order?.id}`);
  }

  private async handleOrderFailed(data: any): Promise<void> {
    this.logger.log(`Printful order failed: ${data.order?.id}`);
  }
}
