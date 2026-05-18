jest.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getAccessToken() {
      return Promise.resolve('mock-token');
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderFulfillmentProcessor } from './order-fulfillment.processor';
import { MerchOrder } from '../entities/merch-order.entity';
import { MerchOrderService } from '../merch-order.service';
import { PrintfulService } from '../../printful/printful.service';

describe('OrderFulfillmentProcessor', () => {
  let processor: OrderFulfillmentProcessor;
  let merchOrderRepo: { findOne: jest.Mock };
  let merchOrderService: { updateOrderWithPrintful: jest.Mock };
  let printfulService: { createOrder: jest.Mock };

  beforeEach(async () => {
    merchOrderRepo = { findOne: jest.fn() };
    merchOrderService = { updateOrderWithPrintful: jest.fn().mockResolvedValue(undefined) };
    printfulService = { createOrder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderFulfillmentProcessor,
        { provide: getRepositoryToken(MerchOrder), useValue: merchOrderRepo },
        { provide: MerchOrderService, useValue: merchOrderService },
        { provide: PrintfulService, useValue: printfulService },
      ],
    }).compile();

    processor = module.get(OrderFulfillmentProcessor);
  });

  function fakeJob(id = 'order-1'): Job<{ merchOrderId: string }> {
    return { data: { merchOrderId: id } } as Job<{ merchOrderId: string }>;
  }

  function fakeOrder(opts: { hasPrintfulId?: boolean; items: Array<{ variantId?: number; productType?: string }> }) {
    return {
      id: 'order-1',
      printful_order_id: opts.hasPrintfulId ? 'pf-existing' : null,
      shipping_address: {
        name: 'Test',
        address1: '1 Main',
        city: 'Brooklyn',
        state_code: 'NY',
        country_code: 'US',
        zip: '11201',
      },
      items: opts.items.map((it, i) => ({
        quantity: 1,
        merchProduct: {
          printful_variant_id: it.variantId ?? null,
          product_type: it.productType ?? 'POSTER',
          image_url: `https://example.com/${i}.png`,
        },
      })),
    };
  }

  it('skips when order already has a Printful order id', async () => {
    merchOrderRepo.findOne.mockResolvedValue(fakeOrder({ hasPrintfulId: true, items: [] }));

    await processor.process(fakeJob());

    expect(printfulService.createOrder).not.toHaveBeenCalled();
    expect(merchOrderService.updateOrderWithPrintful).not.toHaveBeenCalled();
  });

  it('throws UNPROCESSABLE_ENTITY when no items have a printful_variant_id', async () => {
    merchOrderRepo.findOne.mockResolvedValue(
      fakeOrder({ items: [{ variantId: undefined, productType: 'POSTER' }] }),
    );

    await expect(processor.process(fakeJob())).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });

    expect(printfulService.createOrder).not.toHaveBeenCalled();
  });

  it('uses technique="digital" for POSTER items (matches v2 Printful catalog)', async () => {
    merchOrderRepo.findOne.mockResolvedValue(
      fakeOrder({ items: [{ variantId: 19528, productType: 'POSTER' }] }),
    );
    printfulService.createOrder.mockResolvedValue({ data: { id: 'pf-new' } });

    await processor.process(fakeJob());

    const payload = printfulService.createOrder.mock.calls[0][0];
    expect(payload.items[0].placements[0].technique).toBe('digital');
    expect(payload.items[0].placements[0].placement).toBe('default');
  });

  it('uses technique="dtg" for non-poster garment items', async () => {
    merchOrderRepo.findOne.mockResolvedValue(
      fakeOrder({ items: [{ variantId: 4012, productType: 'HOODIE' }] }),
    );
    printfulService.createOrder.mockResolvedValue({ data: { id: 'pf-new' } });

    await processor.process(fakeJob());

    const payload = printfulService.createOrder.mock.calls[0][0];
    expect(payload.items[0].placements[0].technique).toBe('dtg');
    expect(payload.items[0].placements[0].placement).toBe('front');
  });

  it('calls updateOrderWithPrintful with the returned Printful order id', async () => {
    merchOrderRepo.findOne.mockResolvedValue(
      fakeOrder({ items: [{ variantId: 19528, productType: 'POSTER' }] }),
    );
    printfulService.createOrder.mockResolvedValue({ data: { id: 'pf-12345' } });

    await processor.process(fakeJob());

    expect(merchOrderService.updateOrderWithPrintful).toHaveBeenCalledWith('order-1', 'pf-12345');
  });

  it('handles result.id (legacy response shape) as fallback', async () => {
    merchOrderRepo.findOne.mockResolvedValue(
      fakeOrder({ items: [{ variantId: 19528, productType: 'POSTER' }] }),
    );
    printfulService.createOrder.mockResolvedValue({ result: { id: 'pf-67890' } });

    await processor.process(fakeJob());

    expect(merchOrderService.updateOrderWithPrintful).toHaveBeenCalledWith('order-1', 'pf-67890');
  });
});
