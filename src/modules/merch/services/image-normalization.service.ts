import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ProductType } from '../constants';
import { PRODUCT_CATALOG, SkuConfig } from '../constants/product-catalog';

@Injectable()
export class ImageNormalizationService {
  private readonly logger = new Logger(ImageNormalizationService.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
  }

  async normalizeForProduct(sourceImageUrl: string, productType: ProductType, dropId: string): Promise<string> {
    const sku = PRODUCT_CATALOG.find((s) => s.productType === productType);
    if (!sku) {
      throw new Error(`No SKU config for product type ${productType}`);
    }

    try {
      const imageBuffer = await this.downloadImage(sourceImageUrl);

      let outputBuffer: Buffer;
      if (productType === ProductType.POSTER) {
        outputBuffer = await this.createPosterImage(imageBuffer, sku);
      } else {
        outputBuffer = await this.createGarmentImage(imageBuffer, sku);
      }

      const s3Key = `merch/print-files/${dropId}/${productType.toLowerCase()}.png`;
      await this.uploadToS3(outputBuffer, s3Key);

      const url = `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;
      this.logger.log(`Normalized image for ${productType}: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Image normalization failed for ${productType}: ${error.message}`);
      throw error;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  private async createGarmentImage(imageBuffer: Buffer, sku: SkuConfig): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const srcWidth = metadata.width || 1;
    const srcHeight = metadata.height || 1;

    const canvasWidth = sku.printCanvasWidth;
    const canvasHeight = sku.printCanvasHeight;

    const scale = Math.min(canvasWidth / srcWidth, canvasHeight / srcHeight);
    const resizedWidth = Math.round(srcWidth * scale);
    const resizedHeight = Math.round(srcHeight * scale);

    const resized = await sharp(imageBuffer)
      .resize(resizedWidth, resizedHeight, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();

    const left = Math.round((canvasWidth - resizedWidth) / 2);
    const top = Math.round((canvasHeight - resizedHeight) / 2);

    return sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resized, left, top }])
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  private async createPosterImage(imageBuffer: Buffer, sku: SkuConfig): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize(sku.printCanvasWidth, sku.printCanvasHeight, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  private async uploadToS3(buffer: Buffer, key: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      }),
    );
  }
}
