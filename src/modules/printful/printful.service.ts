import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class PrintfulService {
  private readonly logger = new Logger(PrintfulService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.printful.com',
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadFile(fileUrl: string, fileName: string): Promise<any> {
    try {
      const response = await this.client.post('/v2/files', {
        url: fileUrl,
        filename: fileName,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      throw new HttpException('Printful file upload failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async createSyncProduct(storeId: string, productData: {
    name: string;
    thumbnail: string;
    variants: Array<{
      variant_id: number;
      retail_price: string;
      files: Array<{ type: string; url: string }>;
    }>;
  }): Promise<any> {
    try {
      const response = await this.client.post(`/v2/stores/${storeId}/sync-products`, {
        sync_product: { name: productData.name, thumbnail: productData.thumbnail },
        sync_variants: productData.variants.map((v) => ({
          variant_id: v.variant_id,
          retail_price: v.retail_price,
          files: v.files,
        })),
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Create sync product failed: ${error.message}`);
      throw new HttpException('Printful product creation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async createOrder(orderData: {
    recipient: { name: string; address1: string; city: string; state_code: string; country_code: string; zip: string };
    items: Array<{ sync_variant_id: number; quantity: number }>;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/orders', {
        recipient: orderData.recipient,
        items: orderData.items,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Create order failed: ${error.message}`);
      throw new HttpException('Printful order creation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async confirmOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.post(`/v2/orders/${orderId}/confirm`);
      return response.data;
    } catch (error) {
      this.logger.error(`Confirm order failed: ${error.message}`);
      throw new HttpException('Printful order confirmation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async getOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.get(`/v2/orders/${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Get order failed: ${error.message}`);
      throw new HttpException('Printful order retrieval failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async cancelOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.delete(`/v2/orders/${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Cancel order failed: ${error.message}`);
      throw new HttpException('Printful order cancellation failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async getShippingRates(recipient: {
    address1: string; city: string; state_code: string; country_code: string; zip: string;
  }, items: Array<{ variant_id: number; quantity: number }>): Promise<any> {
    try {
      const response = await this.client.post('/v2/shipping/rates', {
        recipient,
        items,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Get shipping rates failed: ${error.message}`);
      throw new HttpException('Printful shipping estimate failed', HttpStatus.BAD_GATEWAY);
    }
  }

  async requestMockup(productId: number): Promise<any> {
    try {
      const response = await this.client.post(`/v2/mockup-generator/create-task/${productId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Request mockup failed: ${error.message}`);
      return null;
    }
  }

  async getMockupResult(taskKey: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/mockup-generator/task/${taskKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Get mockup result failed: ${error.message}`);
      return null;
    }
  }

  async getCatalogVariants(catalogProductId: number): Promise<any[]> {
    try {
      const allVariants: any[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await this.client.get(
          `/v2/catalog-products/${catalogProductId}/catalog-variants`,
          { params: { limit, offset } },
        );
        const variants = response.data?.data || [];
        allVariants.push(...variants);

        if (variants.length < limit) break;
        offset += limit;
      }

      return allVariants;
    } catch (error) {
      this.logger.error(`Get catalog variants failed for product ${catalogProductId}: ${error.message}`);
      throw new HttpException('Printful catalog lookup failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
