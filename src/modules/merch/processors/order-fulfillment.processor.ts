import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchOrder } from '../entities/merch-order.entity';
import { MerchOrderService } from '../merch-order.service';
import { PrintfulService } from '../../printful/printful.service';

@Processor('order-fulfillment', { concurrency: 2 })
export class OrderFulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderFulfillmentProcessor.name);

  constructor(
    @InjectRepository(MerchOrder)
    private merchOrderRepo: Repository<MerchOrder>,
    private merchOrderService: MerchOrderService,
    private printfulService: PrintfulService,
  ) {
    super();
  }

  async process(job: Job<{ merchOrderId: string }>): Promise<void> {
    const { merchOrderId } = job.data;
    this.logger.log(`Processing order fulfillment for ${merchOrderId}`);

    try {
      const order = await this.merchOrderRepo.findOne({
        where: { id: merchOrderId },
        relations: ['items', 'items.merchProduct'],
      });

      if (!order) {
        this.logger.error(`Order ${merchOrderId} not found`);
        return;
      }

      if (order.printful_order_id) {
        this.logger.log(`Order ${merchOrderId} already has Printful order ${order.printful_order_id}, skipping`);
        return;
      }

      const address = order.shipping_address as any;
      const fulfillableItems = order.items.filter(
        (item) => item.merchProduct?.printful_variant_id,
      );
      if (fulfillableItems.length === 0) {
        // Don't silently submit an empty Printful draft (Printful accepts
        // 0-item orders and returns 201, which used to look like success).
        // Fail loud so the job surfaces in the failed queue for an operator.
        this.logger.error(
          `Order ${merchOrderId} has 0 fulfillable items (no products are linked to Printful catalog variants). Skipping Printful submission.`,
        );
        throw new HttpException(
          'No fulfillable items: products are missing printful_variant_id',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const printfulOrder = await this.printfulService.createOrder({
        recipient: {
          name: address.name,
          address1: address.address1,
          city: address.city,
          state_code: address.state_code,
          country_code: address.country_code,
          zip: address.zip,
        },
        items: fulfillableItems.map((item) => {
            const isGarment = item.merchProduct.product_type !== 'POSTER';
            return {
              source: 'catalog',
              catalog_variant_id: Number(item.merchProduct.printful_variant_id),
              quantity: item.quantity,
              placements: [
                {
                  placement: isGarment ? 'front' : 'default',
                  technique: isGarment ? 'dtg' : 'digital',
                  layers: [
                    {
                      type: 'file',
                      url: item.merchProduct.image_url,
                    },
                  ],
                },
              ],
            };
          }),
      });

      const printfulOrderId = printfulOrder?.data?.id || printfulOrder?.result?.id;
      if (printfulOrderId) {
        await this.merchOrderService.updateOrderWithPrintful(merchOrderId, printfulOrderId);
        this.logger.log(`Order ${merchOrderId} submitted to Printful as ${printfulOrderId}`);
      }
    } catch (error) {
      this.logger.error(`Order fulfillment failed for ${merchOrderId}: ${error.message}`);
      throw error;
    }
  }
}
