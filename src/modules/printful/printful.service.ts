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
        'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
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

  async createSyncProduct(productData: {
    name: string;
    thumbnail: string;
    variants: Array<{
      variant_id: number;
      retail_price: string;
      placement: string;
      technique: string;
      file_url: string;
    }>;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/sync-products', {
        sync_product: { name: productData.name, thumbnail: productData.thumbnail },
        sync_variants: productData.variants.map((v) => ({
          source: 'catalog',
          catalog_variant_id: v.variant_id,
          retail_price: v.retail_price,
          placements: [
            {
              placement: v.placement,
              technique: v.technique,
              layers: [{ type: 'file', url: v.file_url }],
            },
          ],
        })),
      });
      return response.data;
    } catch (error) {
      const printfulBody = error?.response?.data
        ? JSON.stringify(error.response.data)
        : '';
      this.logger.error(`Create sync product failed: ${error.message} ${printfulBody}`);
      throw new HttpException(
        printfulBody ? `Printful product creation failed: ${printfulBody}` : 'Printful product creation failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async createOrder(orderData: {
    recipient: { name: string; address1: string; city: string; state_code: string; country_code: string; zip: string };
    items: Array<{
      source: string;
      catalog_variant_id: number;
      quantity: number;
      placements: Array<{
        placement: string;
        technique: string;
        layers: Array<{ type: string; url: string }>;
      }>;
    }>;
  }): Promise<any> {
    try {
      const response = await this.client.post('/v2/orders', {
        recipient: orderData.recipient,
        items: orderData.items,
      });
      return response.data;
    } catch (error) {
      const printfulBody = error?.response?.data
        ? JSON.stringify(error.response.data)
        : '';
      this.logger.error(`Create order failed: ${error.message} ${printfulBody}`);
      throw new HttpException(
        printfulBody ? `Printful order creation failed: ${printfulBody}` : 'Printful order creation failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async confirmOrder(orderId: number): Promise<any> {
    try {
      const response = await this.client.post(`/v2/orders/${orderId}/confirmation`);
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
  }, items: Array<{ catalog_variant_id: number; quantity: number }>): Promise<any> {
    try {
      const response = await this.client.post('/v2/shipping-rates', {
        recipient,
        order_items: items.map((item) => ({
          source: 'catalog',
          catalog_variant_id: item.catalog_variant_id,
          quantity: item.quantity,
        })),
        currency: 'USD',
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Get shipping rates failed: ${error.message}`);
      throw new HttpException('Printful shipping estimate failed', HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Kicks off Printful's mockup generator for a catalog product. The print
   * file is composited onto each requested variant; the resulting mockup
   * URLs show the actual garment with the autograph design printed on it
   * (i.e. what fans see in the merch grid).
   *
   * @param catalogProductId Printful catalog product id (e.g. 71 for the
   *   Bella+Canvas tee). NOT the sync product id.
   * @param variantIds Catalog variant ids (per color/size combo).
   * @param printFileUrl Public URL of the autograph print file.
   * @param placement "front" for garments, "default" for posters.
   * @returns task_key for polling, or null if the request failed.
   */
  async requestMockupTask(
    catalogProductId: number,
    variantIds: number[],
    printFileUrl: string,
    placement: string,
    imageDimensions?: { width: number; height: number },
    chestOffsetRatio = 0,
  ): Promise<string | null> {
    try {
      const pos = await this.getPrintfilePosition(catalogProductId, placement);
      const file: any = {
        placement,
        image_url: printFileUrl,
      };
      if (pos) {
        let fitWidth = pos.width;
        let fitHeight = pos.height;
        let top = 0;
        let left = 0;
        if (imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0) {
          const scale = Math.min(
            pos.width / imageDimensions.width,
            pos.height / imageDimensions.height,
          );
          fitWidth = Math.round(imageDimensions.width * scale);
          fitHeight = Math.round(imageDimensions.height * scale);
          // Center, then nudge vertically so the design lands on the chest for
          // this garment. Clamp so the artwork never spills outside the print
          // area regardless of the offset.
          const centeredTop = (pos.height - fitHeight) / 2;
          const nudged = centeredTop + chestOffsetRatio * pos.height;
          top = Math.round(Math.max(0, Math.min(pos.height - fitHeight, nudged)));
          left = Math.round((pos.width - fitWidth) / 2);
        }
        file.position = {
          area_width: pos.width,
          area_height: pos.height,
          width: fitWidth,
          height: fitHeight,
          top,
          left,
        };
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const response = await this.client.post(
            `/mockup-generator/create-task/${catalogProductId}`,
            {
              variant_ids: variantIds,
              files: [file],
              format: 'jpg',
            },
          );
          return (
            response.data?.result?.task_key || response.data?.task_key || null
          );
        } catch (error: any) {
          if (error?.response?.status === 429) {
            const msg = error?.response?.data?.result || '';
            const m = String(msg).match(/after (\d+) seconds/);
            const waitS = m ? Number(m[1]) + 2 : 30;
            this.logger.warn(
              `[MOCKUP] 429 on product ${catalogProductId}, waiting ${waitS}s (attempt ${attempt + 1}/5)`,
            );
            await new Promise((r) => setTimeout(r, waitS * 1000));
            continue;
          }
          const body = error?.response?.data
            ? JSON.stringify(error.response.data).slice(0, 200)
            : '';
          this.logger.error(
            `Request mockup task failed for product ${catalogProductId}: ${error.message} ${body}`,
          );
          return null;
        }
      }
      this.logger.error(
        `Request mockup task gave up after retries for product ${catalogProductId}`,
      );
      return null;
    } catch (error: any) {
      this.logger.error(
        `Request mockup task setup failed for product ${catalogProductId}: ${error.message}`,
      );
      return null;
    }
  }

  private printfileCache = new Map<string, { width: number; height: number }>();

  async getPrintfilePosition(
    catalogProductId: number,
    placement: string,
  ): Promise<{ width: number; height: number } | null> {
    const cacheKey = `${catalogProductId}:${placement}`;
    const hit = this.printfileCache.get(cacheKey);
    if (hit) return hit;
    try {
      const response = await this.client.get(
        `/mockup-generator/printfiles/${catalogProductId}`,
      );
      const result = response.data?.result;
      const printfiles: any[] = result?.printfiles || [];
      const variantPrintfiles: any[] = result?.variant_printfiles || [];

      let printfileId: number | null = null;
      for (const vp of variantPrintfiles) {
        const map = vp?.placements;
        if (map && typeof map === 'object' && map[placement] != null) {
          printfileId = Number(map[placement]);
          break;
        }
      }

      const pf =
        (printfileId != null
          ? printfiles.find((p: any) => p?.printfile_id === printfileId)
          : null) || printfiles[0];

      if (!pf?.width || !pf?.height) return null;
      const dims = { width: Number(pf.width), height: Number(pf.height) };
      this.printfileCache.set(cacheKey, dims);
      return dims;
    } catch (error: any) {
      this.logger.warn(
        `Get printfiles failed for product ${catalogProductId}: ${error?.message}`,
      );
      return null;
    }
  }

  /**
   * Polls a mockup-generator task. Returns the mockups array once status
   * is "completed", null on still-pending or failure. Each mockup entry
   * contains variant_ids (the ones it applies to) and mockup_url.
   */
  async getMockupTask(taskKey: string): Promise<{
    status: string;
    mockups?: Array<{
      placement?: string;
      variant_ids: number[];
      mockup_url: string;
    }>;
  } | null> {
    try {
      const response = await this.client.get(
        `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      );
      const result = response.data?.result;
      if (!result) return null;
      return {
        status: result.status,
        mockups: result.mockups,
      };
    } catch (error: any) {
      this.logger.error(
        `Get mockup task failed for ${taskKey}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Convenience: start a mockup task and poll until it completes or times
   * out. Returns a flat map of variant_id -> mockup_url.
   */
  async generateMockups(
    catalogProductId: number,
    variantIds: number[],
    printFileUrl: string,
    placement: string,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      imageDimensions?: { width: number; height: number };
      chestOffsetRatio?: number;
    } = {},
  ): Promise<Record<number, string>> {
    const taskKey = await this.requestMockupTask(
      catalogProductId,
      variantIds,
      printFileUrl,
      placement,
      options.imageDimensions,
      options.chestOffsetRatio ?? 0,
    );
    if (!taskKey) return {};

    const maxAttempts = options.maxAttempts ?? 24;
    const intervalMs = options.intervalMs ?? 5000;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const res = await this.getMockupTask(taskKey);
      if (!res) continue;
      if (res.status === 'completed' && Array.isArray(res.mockups)) {
        const out: Record<number, string> = {};
        for (const m of res.mockups) {
          for (const vid of m.variant_ids || []) {
            if (!out[vid]) out[vid] = m.mockup_url;
          }
        }
        return out;
      }
      if (res.status === 'failed') {
        this.logger.warn(
          `Mockup task ${taskKey} failed for product ${catalogProductId}`,
        );
        return {};
      }
    }
    this.logger.warn(
      `Mockup task ${taskKey} timed out after ${maxAttempts * intervalMs}ms`,
    );
    return {};
  }

  async getSyncProduct(syncProductId: number): Promise<any> {
    try {
      // v1 endpoint returns sync_variants with product.image (actual garment
      // photos from Printful's catalog, per color/size). v2 sync-products
      // returns only the wrapper without variant images, so we use v1.
      const response = await this.client.get(
        `/store/products/${syncProductId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Get sync product failed for ${syncProductId}: ${error.message}`,
      );
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
